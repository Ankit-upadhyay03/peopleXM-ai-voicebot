"""Analytics service — computes real-time metrics from MongoDB conversation_logs.

All metrics are derived strictly from the database. No mock data, no Math.random().
If the database is empty, all values return 0.

Aggregation pipelines:
    - Total questions: countDocuments
    - Avg confidence: $avg on confidence field
    - Failed queries: count where confidence == 0 (fallback answers)
    - Today's usage: count where timestamp is today
    - Hourly traffic: $group by $hour of timestamp (today only)
    - Weekly volume: $group by $dayOfWeek of timestamp (last 7 days)
    - Top questions: $group by question text, sorted by frequency
    - Confidence distribution: bucket into High/Medium/Low
    - Success rate: (total - failed) / total * 100
"""

from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List

from ..database.mongodb import mongo_client

COLLECTION_NAME = "conversation_logs"

# IST timezone (UTC+5:30)
IST = timezone(timedelta(hours=5, minutes=30))


class AnalyticsService:
    """Compute analytics metrics from MongoDB conversation_logs collection."""

    def __init__(self):
        self._collection = None

    @property
    def collection(self):
        if self._collection is None:
            self._collection = mongo_client.db[COLLECTION_NAME]
        return self._collection

    def get_full_analytics(self) -> Dict[str, Any]:
        """
        Compute all dashboard metrics from the database.

        Returns a complete analytics payload with zeroed defaults if DB is empty.
        """
        if not mongo_client.is_connected:
            return self._empty_analytics()

        total_questions = self._get_total_questions()
        failed_queries = self._get_failed_queries()
        avg_confidence = self._get_avg_confidence()
        today_usage = self._get_today_usage()
        success_rate = ((total_questions - failed_queries) / total_questions * 100) if total_questions > 0 else 0
        hourly_traffic = self._get_hourly_traffic()
        weekly_volume = self._get_weekly_volume()
        top_questions = self._get_top_questions()
        confidence_distribution = self._get_confidence_distribution()

        return {
            "totalQuestions": total_questions,
            "avgConfidence": round(avg_confidence, 1),
            "failedQueries": failed_queries,
            "todayUsage": today_usage,
            "successRate": round(success_rate, 1),
            "avgResponseTime": self._get_avg_response_time(),
            "hourlyTraffic": hourly_traffic,
            "weeklyVolume": weekly_volume,
            "topQuestions": top_questions,
            "confidenceDistribution": confidence_distribution,
        }

    def _get_total_questions(self) -> int:
        """Count all documents in conversation_logs."""
        try:
            return self.collection.count_documents({})
        except Exception:
            return 0

    def _get_failed_queries(self) -> int:
        """Count queries where confidence == 0 (fallback/no-answer responses)."""
        try:
            return self.collection.count_documents({"confidence": 0})
        except Exception:
            return 0

    def _get_avg_confidence(self) -> float:
        """Average confidence score across all queries."""
        try:
            pipeline = [
                {"$group": {"_id": None, "avg": {"$avg": "$confidence"}}}
            ]
            result = list(self.collection.aggregate(pipeline))
            return result[0]["avg"] if result and result[0]["avg"] is not None else 0
        except Exception:
            return 0

    def _get_today_usage(self) -> int:
        """Count queries from today (IST)."""
        try:
            today_start = datetime.now(IST).replace(hour=0, minute=0, second=0, microsecond=0)
            return self.collection.count_documents({"timestamp": {"$gte": today_start}})
        except Exception:
            return 0

    def _get_avg_response_time(self) -> float:
        """
        Approximate average response time in seconds.

        Since we don't store separate request/response timestamps,
        we compute the average time gap between consecutive logs in the same session.
        If not enough data, return 0.
        """
        try:
            pipeline = [
                {"$sort": {"session_id": 1, "timestamp": 1}},
                {"$group": {
                    "_id": "$session_id",
                    "timestamps": {"$push": "$timestamp"},
                    "count": {"$sum": 1},
                }},
                {"$match": {"count": {"$gte": 2}}},
                {"$limit": 50},
            ]
            sessions = list(self.collection.aggregate(pipeline))

            if not sessions:
                return 0

            total_gap = 0
            total_pairs = 0
            for session in sessions:
                ts_list = session["timestamps"]
                for i in range(1, len(ts_list)):
                    gap = (ts_list[i] - ts_list[i - 1]).total_seconds()
                    if 0 < gap < 300:  # Ignore gaps > 5 min (separate conversations)
                        total_gap += gap
                        total_pairs += 1

            return round(total_gap / total_pairs, 1) if total_pairs > 0 else 0
        except Exception:
            return 0

    def _get_hourly_traffic(self) -> List[Dict[str, Any]]:
        """
        Get query count per hour for today.

        Returns list of {"hour": "9AM", "queries": 12} for each hour 6AM-11PM.
        """
        try:
            today_start = datetime.now(IST).replace(hour=0, minute=0, second=0, microsecond=0)

            pipeline = [
                {"$match": {"timestamp": {"$gte": today_start}}},
                {"$group": {
                    "_id": {"$hour": "$timestamp"},
                    "count": {"$sum": 1},
                }},
                {"$sort": {"_id": 1}},
            ]
            result = list(self.collection.aggregate(pipeline))

            # Build full 6AM-11PM range with 0 defaults
            hour_map = {r["_id"]: r["count"] for r in result}
            hours = []
            for h in range(6, 24):
                label = f"{h}AM" if h < 12 else (f"{h-12}PM" if h > 12 else "12PM")
                if h < 10:
                    label = f"{h}AM"
                elif h == 12:
                    label = "12PM"
                else:
                    label = f"{h-12}PM"
                hours.append({"hour": label, "queries": hour_map.get(h, 0)})

            return hours
        except Exception:
            return [{"hour": f"{h}AM" if h < 12 else f"{h-12}PM", "queries": 0} for h in range(6, 24)]

    def _get_weekly_volume(self) -> List[Dict[str, Any]]:
        """
        Get query count per day for the last 7 days.

        Returns list of {"day": "Mon", "queries": 145}.
        """
        try:
            week_ago = datetime.now(IST) - timedelta(days=7)

            pipeline = [
                {"$match": {"timestamp": {"$gte": week_ago}}},
                {"$group": {
                    "_id": {"$dayOfWeek": "$timestamp"},  # 1=Sun, 2=Mon, ..., 7=Sat
                    "count": {"$sum": 1},
                }},
                {"$sort": {"_id": 1}},
            ]
            result = list(self.collection.aggregate(pipeline))

            day_map = {r["_id"]: r["count"] for r in result}
            # MongoDB $dayOfWeek: 1=Sun, 2=Mon, 3=Tue, 4=Wed, 5=Thu, 6=Fri, 7=Sat
            day_names = {2: "Mon", 3: "Tue", 4: "Wed", 5: "Thu", 6: "Fri", 7: "Sat", 1: "Sun"}
            days = []
            for dow in [2, 3, 4, 5, 6, 7, 1]:  # Mon through Sun
                days.append({"day": day_names[dow], "queries": day_map.get(dow, 0)})

            return days
        except Exception:
            return [{"day": d, "queries": 0} for d in ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]]

    def _get_top_questions(self, limit: int = 5) -> List[Dict[str, Any]]:
        """
        Get most frequently asked questions, grouped by exact text.

        Returns list of {"question": "How do I reset my password?", "count": 156}.
        """
        try:
            pipeline = [
                {"$group": {
                    "_id": "$question",
                    "count": {"$sum": 1},
                }},
                {"$sort": {"count": -1}},
                {"$limit": limit},
                {"$project": {"_id": 0, "question": "$_id", "count": 1}},
            ]
            result = list(self.collection.aggregate(pipeline))
            return result if result else []
        except Exception:
            return []

    def _get_confidence_distribution(self) -> List[Dict[str, Any]]:
        """
        Bucket confidence scores into High/Medium/Low.

        High: 80-100, Medium: 50-79, Low: 0-49
        """
        try:
            total = self.collection.count_documents({})
            if total == 0:
                return [
                    {"name": "High (80-100%)", "value": 0, "color": "#10b981"},
                    {"name": "Medium (50-79%)", "value": 0, "color": "#f59e0b"},
                    {"name": "Low (0-49%)", "value": 0, "color": "#ef4444"},
                ]

            high = self.collection.count_documents({"confidence": {"$gte": 80}})
            medium = self.collection.count_documents({"confidence": {"$gte": 50, "$lt": 80}})
            low = self.collection.count_documents({"confidence": {"$lt": 50}})

            return [
                {"name": "High (80-100%)", "value": round(high / total * 100), "color": "#10b981"},
                {"name": "Medium (50-79%)", "value": round(medium / total * 100), "color": "#f59e0b"},
                {"name": "Low (0-49%)", "value": round(low / total * 100), "color": "#ef4444"},
            ]
        except Exception:
            return [
                {"name": "High (80-100%)", "value": 0, "color": "#10b981"},
                {"name": "Medium (50-79%)", "value": 0, "color": "#f59e0b"},
                {"name": "Low (0-49%)", "value": 0, "color": "#ef4444"},
            ]

    def _empty_analytics(self) -> Dict[str, Any]:
        """Return zeroed analytics when DB is unavailable or empty."""
        return {
            "totalQuestions": 0,
            "avgConfidence": 0,
            "failedQueries": 0,
            "todayUsage": 0,
            "successRate": 0,
            "avgResponseTime": 0,
            "hourlyTraffic": [{"hour": f"{h}AM" if h < 12 else f"{h-12}PM", "queries": 0} for h in range(6, 24)],
            "weeklyVolume": [{"day": d, "queries": 0} for d in ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]],
            "topQuestions": [],
            "confidenceDistribution": [
                {"name": "High (80-100%)", "value": 0, "color": "#10b981"},
                {"name": "Medium (50-79%)", "value": 0, "color": "#f59e0b"},
                {"name": "Low (0-49%)", "value": 0, "color": "#ef4444"},
            ],
        }


# Singleton
analytics_service = AnalyticsService()

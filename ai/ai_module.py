"""
SustainAI – AI Module v2.0
Features:
  1. Expiry Prediction
  2. Usage Suggestions
  3. Nearest NGO Finder (Haversine)
  4. Waste Calculator
  5. [NEW] A* Route Optimization
  6. [NEW] NLP Chatbot Assistant
"""

import sys, json, math, heapq, random
from datetime import datetime

# =============================================================================
#  ORIGINAL AI FEATURES (unchanged)
# =============================================================================

def predict_expiry(expiry_str):
    """Classify food urgency based on hours until expiry."""
    try:
        exp = datetime.fromisoformat(expiry_str.replace('Z', '+00:00'))
        now = datetime.now(exp.tzinfo) if exp.tzinfo else datetime.now()
        hrs = (exp - now).total_seconds() / 3600
        if hrs <= 0:
            label = "Expired"
        elif hrs <= 24:
            label = "Critical"
        elif hrs <= 48:
            label = "2 Days"
        elif hrs <= 72:
            label = "3 Days"
        else:
            label = "Fresh"
        return {"hours_left": round(hrs, 1), "label": label, "is_expired": hrs <= 0}
    except:
        return {"hours_left": 24, "label": "Fresh", "is_expired": False}


def suggest_usage(items):
    """Recommend actions for near-expiry items."""
    suggestions = []
    for item in items:
        exp = predict_expiry(item.get("expiry", ""))
        if exp["label"] == "Critical":
            suggestions.append({
                "item": item["name"],
                "action": "URGENT: Donate immediately to nearest NGO",
                "priority": "high"
            })
        elif exp["label"] == "2 Days":
            suggestions.append({
                "item": item["name"],
                "action": "Plan donation within 24hrs",
                "priority": "medium"
            })
        elif exp["label"] == "3 Days":
            suggestions.append({
                "item": item["name"],
                "action": "Use in meals or schedule pickup",
                "priority": "low"
            })
    return suggestions


def find_nearest_ngo(lat, lon, ngos):
    """Find the nearest NGO using Haversine distance."""
    nearest, min_d = None, float('inf')
    R = 6371  # Earth radius in km
    for n in ngos:
        try:
            la, lo = float(n['lat']), float(n['lon'])
            dl, dn = math.radians(la - lat), math.radians(lo - lon)
            a = math.sin(dl / 2) ** 2 + math.cos(math.radians(lat)) * math.cos(math.radians(la)) * math.sin(dn / 2) ** 2
            d = R * (2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))
            if d < min_d:
                min_d, nearest = d, n
        except:
            continue
    if nearest:
        nearest['distance'] = round(min_d, 2)
    return nearest


def calculate_waste(total_produced, total_saved):
    """Compute waste efficiency metrics."""
    wasted = max(0, total_produced - total_saved)
    pct = round((total_saved / total_produced * 100), 1) if total_produced > 0 else 0
    return {"wasted": wasted, "saved": total_saved, "efficiency": pct}


# =============================================================================
#  FEATURE 1: A* ROUTE OPTIMIZATION
# =============================================================================

def _haversine(lat1, lon1, lat2, lon2):
    """Calculate the great-circle distance between two points (km)."""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _generate_grid_graph(start, end, grid_size=5):
    """
    Generate a realistic grid of waypoints between start and end for A* traversal.
    This simulates a road-network-like graph with variable edge costs.

    Returns:
        nodes: dict of node_id -> (lat, lon)
        edges: dict of node_id -> [(neighbor_id, cost), ...]
        start_id: id of start node
        end_id: id of end node
    """
    lat_min = min(start[0], end[0])
    lat_max = max(start[0], end[0])
    lon_min = min(start[1], end[1])
    lon_max = max(start[1], end[1])

    # Add padding around the bounding box (10% each side)
    lat_pad = max((lat_max - lat_min) * 0.1, 0.005)
    lon_pad = max((lon_max - lon_min) * 0.1, 0.005)
    lat_min -= lat_pad
    lat_max += lat_pad
    lon_min -= lon_pad
    lon_max += lon_pad

    nodes = {}
    node_id = 0

    # Create grid of intermediate waypoints
    lat_step = (lat_max - lat_min) / (grid_size - 1)
    lon_step = (lon_max - lon_min) / (grid_size - 1)

    grid = {}  # (row, col) -> node_id
    for r in range(grid_size):
        for c in range(grid_size):
            lat = lat_min + r * lat_step + random.uniform(-lat_step * 0.15, lat_step * 0.15)
            lon = lon_min + c * lon_step + random.uniform(-lon_step * 0.15, lon_step * 0.15)
            nodes[node_id] = (round(lat, 6), round(lon, 6))
            grid[(r, c)] = node_id
            node_id += 1

    # Add start and end as special nodes
    start_id = node_id
    nodes[start_id] = (start[0], start[1])
    node_id += 1

    end_id = node_id
    nodes[end_id] = (end[0], end[1])

    # Build edges: connect grid neighbors (4-directional + diagonals)
    edges = {nid: [] for nid in nodes}
    directions = [(-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)]

    for r in range(grid_size):
        for c in range(grid_size):
            current = grid[(r, c)]
            for dr, dc in directions:
                nr, nc = r + dr, c + dc
                if 0 <= nr < grid_size and 0 <= nc < grid_size:
                    neighbor = grid[(nr, nc)]
                    dist = _haversine(nodes[current][0], nodes[current][1],
                                      nodes[neighbor][0], nodes[neighbor][1])
                    # Add road factor (simulate roads being longer than straight-line)
                    road_factor = 1.0 + random.uniform(0.05, 0.25)
                    edges[current].append((neighbor, round(dist * road_factor, 4)))

    # Connect start node to nearest grid nodes
    start_distances = []
    for nid in range(len(nodes) - 2):  # Exclude start and end
        d = _haversine(start[0], start[1], nodes[nid][0], nodes[nid][1])
        start_distances.append((d, nid))
    start_distances.sort()
    for d, nid in start_distances[:4]:  # Connect to 4 nearest grid points
        edges[start_id].append((nid, round(d * 1.1, 4)))
        edges[nid].append((start_id, round(d * 1.1, 4)))

    # Connect end node to nearest grid nodes
    end_distances = []
    for nid in range(len(nodes) - 2):
        d = _haversine(end[0], end[1], nodes[nid][0], nodes[nid][1])
        end_distances.append((d, nid))
    end_distances.sort()
    for d, nid in end_distances[:4]:
        edges[end_id].append((nid, round(d * 1.1, 4)))
        edges[nid].append((end_id, round(d * 1.1, 4)))

    return nodes, edges, start_id, end_id


def astar_route(hotel_location, ngo_location):
    """
    A* (A-star) algorithm for optimal delivery route between Hotel and NGO.

    Uses Haversine distance as the heuristic (admissible — never overestimates).
    Generates a realistic waypoint grid to simulate road network traversal.

    Input:
        hotel_location: {"lat": float, "lon": float}
        ngo_location:   {"lat": float, "lon": float}

    Output:
        {
            "path": [{"lat": float, "lon": float}, ...],
            "distance": float (km),
            "estimated_time": float (minutes, assumes 30 km/h avg city speed)
        }
    """
    start = (float(hotel_location["lat"]), float(hotel_location["lon"]))
    end = (float(ngo_location["lat"]), float(ngo_location["lon"]))

    # Direct distance for reference
    direct_dist = _haversine(start[0], start[1], end[0], end[1])

    # For very short distances (< 0.5 km), return direct path
    if direct_dist < 0.5:
        return {
            "path": [
                {"lat": start[0], "lon": start[1]},
                {"lat": end[0], "lon": end[1]}
            ],
            "distance": round(direct_dist, 2),
            "estimated_time": round(direct_dist / 0.5 * 1, 1)  # ~walking speed
        }

    # Generate grid graph for A* traversal
    random.seed(int((start[0] + end[0]) * 10000))  # Deterministic for same locations
    nodes, edges, start_id, end_id = _generate_grid_graph(start, end, grid_size=6)

    # ── A* Algorithm ──
    # Priority queue: (f_score, node_id)
    open_set = [(0, start_id)]
    came_from = {}
    g_score = {nid: float('inf') for nid in nodes}
    g_score[start_id] = 0
    f_score = {nid: float('inf') for nid in nodes}
    f_score[start_id] = _haversine(start[0], start[1], end[0], end[1])
    closed_set = set()

    while open_set:
        current_f, current = heapq.heappop(open_set)

        if current == end_id:
            # Reconstruct path
            path = []
            node = end_id
            while node in came_from:
                lat, lon = nodes[node]
                path.append({"lat": round(lat, 6), "lon": round(lon, 6)})
                node = came_from[node]
            # Add start
            path.append({"lat": round(nodes[start_id][0], 6), "lon": round(nodes[start_id][1], 6)})
            path.reverse()

            total_distance = round(g_score[end_id], 2)
            # Estimate time: avg 30 km/h in city traffic
            est_time = round((total_distance / 30) * 60, 1)

            return {
                "path": path,
                "distance": total_distance,
                "estimated_time": est_time
            }

        if current in closed_set:
            continue
        closed_set.add(current)

        for neighbor, cost in edges.get(current, []):
            if neighbor in closed_set:
                continue

            tentative_g = g_score[current] + cost

            if tentative_g < g_score[neighbor]:
                came_from[neighbor] = current
                g_score[neighbor] = tentative_g
                # Heuristic: Haversine distance to goal (admissible)
                h = _haversine(nodes[neighbor][0], nodes[neighbor][1], end[0], end[1])
                f_score[neighbor] = tentative_g + h
                heapq.heappush(open_set, (f_score[neighbor], neighbor))

    # Fallback: if no path found (shouldn't happen with our grid), return direct route
    return {
        "path": [
            {"lat": start[0], "lon": start[1]},
            {"lat": end[0], "lon": end[1]}
        ],
        "distance": round(direct_dist * 1.3, 2),
        "estimated_time": round((direct_dist * 1.3 / 30) * 60, 1)
    }


# =============================================================================
#  FEATURE 2: NLP CHATBOT ASSISTANT
# =============================================================================

# Keyword-to-intent mapping for rule-based NLP
INTENT_KEYWORDS = {
    "expiry": [
        "expir", "expiry", "expire", "shelf life", "going bad", "rotting",
        "stale", "old food", "how long", "best before"
    ],
    "donate": [
        "donat", "give", "surplus", "extra food", "leftover", "share food",
        "contribute", "send food", "distribute"
    ],
    "nearby": [
        "nearby", "near me", "closest", "nearest", "find ngo", "location",
        "where", "around me", "local ngo", "close to"
    ],
    "waste": [
        "waste", "wasted", "reduce waste", "food waste", "thrown away",
        "garbage", "loss", "efficiency", "save food", "minimize"
    ],
    "help": [
        "help", "how to", "guide", "what can", "how do", "assist",
        "support", "tutorial", "explain", "tell me"
    ],
    "greeting": [
        "hello", "hi", "hey", "good morning", "good evening", "namaste",
        "howdy", "greetings", "what's up", "sup"
    ],
    "status": [
        "status", "track", "delivery", "where is", "order", "pickup",
        "dispatch", "shipping", "progress"
    ],
    "analytics": [
        "analytics", "stats", "statistics", "report", "data", "dashboard",
        "numbers", "metrics", "performance", "summary"
    ]
}

# Pre-built responses for each intent
INTENT_RESPONSES = {
    "expiry": [
        "🕐 For expiring food, I recommend:\n"
        "1. **Critical (< 24hrs):** Donate IMMEDIATELY to the nearest NGO\n"
        "2. **2 Days left:** Schedule a pickup or find an NGO partner\n"
        "3. **3 Days left:** Use in today's meals or plan a donation\n\n"
        "💡 Tip: Check the 'Expiring' tab in your dashboard for AI-powered alerts!",

        "⏰ Food nearing expiry? Here's what to do:\n"
        "• **Act fast** — every hour counts for food safety\n"
        "• **List it now** on SustainAI so NGOs can request it\n"
        "• **Use the AI Suggestions** page for item-specific recommendations\n\n"
        "Remember: Donated food saves lives and reduces waste! ♻️"
    ],
    "donate": [
        "🤝 To donate surplus food:\n"
        "1. Go to **Add Item** in your Hotel Dashboard\n"
        "2. Fill in the food name, category, quantity & expiry date\n"
        "3. Upload a photo so NGOs can see the food quality\n"
        "4. Click Submit — NGOs will be notified automatically!\n\n"
        "💚 Thank you for reducing food waste!",

        "🍽️ Great initiative! Here's how to get started:\n"
        "• Navigate to **➕ Add Item** from the sidebar\n"
        "• Provide accurate details (category, quantity, expiry)\n"
        "• NGOs will send pickup requests\n"
        "• Approve and track delivery in real-time\n\n"
        "Every donation matters! 🌱"
    ],
    "nearby": [
        "📍 To find nearby NGOs:\n"
        "• Our AI module uses **geospatial matching** to find the closest NGO\n"
        "• When you list food, the system automatically maps nearby organizations\n"
        "• NGOs in your area are prioritized for faster pickup\n\n"
        "🔍 Check the **Food Map** page for a visual overview!",

        "🗺️ Finding nearby partners:\n"
        "• SustainAI uses **Haversine distance** to calculate proximity\n"
        "• The system connects you with the **nearest available NGO**\n"
        "• Delivery routes are optimized using our **A* algorithm**\n\n"
        "Your food reaches those in need faster! ⚡"
    ],
    "waste": [
        "♻️ Tips to reduce food waste:\n"
        "1. **Monitor inventory** daily using the dashboard\n"
        "2. **Set alerts** for items approaching expiry\n"
        "3. **Donate early** — don't wait until the last minute\n"
        "4. **Track analytics** to identify waste patterns\n"
        "5. **Use AI suggestions** for smart inventory management\n\n"
        "📊 Check your Analytics page to see your waste reduction score!",

        "🌍 Food waste reduction strategies:\n"
        "• **First-In-First-Out (FIFO):** Use older stock first\n"
        "• **Portion control:** Prepare what you need\n"
        "• **Donate surplus:** List on SustainAI immediately\n"
        "• **Track patterns:** Our analytics show where waste happens\n\n"
        "Together we can achieve Zero Waste! 💪"
    ],
    "help": [
        "👋 Welcome to SustainAI! Here's what I can help with:\n\n"
        "🏨 **For Hotels:**\n"
        "• Add surplus food items\n"
        "• Manage NGO requests\n"
        "• Track deliveries\n"
        "• View AI-powered suggestions\n\n"
        "🤝 **For NGOs:**\n"
        "• Browse available food\n"
        "• Send pickup requests\n"
        "• Track delivery status\n\n"
        "💡 Try asking me about: *expiring food, donations, nearby NGOs, waste reduction, analytics*",

        "🤖 I'm your SustainAI assistant! I can help with:\n\n"
        "• 🕐 **Expiry advice** — What to do with aging food\n"
        "• 🍽️ **Donation guidance** — How to list surplus food\n"
        "• 📍 **Nearby NGOs** — Finding pickup partners\n"
        "• ♻️ **Waste tips** — Reducing food waste\n"
        "• 📊 **Analytics** — Understanding your impact\n"
        "• 🚚 **Delivery tracking** — Status of pickups\n\n"
        "Just type your question naturally! 😊"
    ],
    "greeting": [
        "👋 Hello! I'm the SustainAI assistant.\n"
        "How can I help you reduce food waste today?\n\n"
        "Try asking about: *expiring food, donations, nearby NGOs, or waste tips!*",

        "🌿 Hi there! Welcome to SustainAI.\n"
        "I'm here to help you manage food inventory and reduce waste.\n\n"
        "What would you like to know? 😊"
    ],
    "status": [
        "🚚 To track your deliveries:\n"
        "• Go to **Delivery Status** from the sidebar\n"
        "• You'll see all active deliveries with real-time status\n"
        "• Status updates: Pending → In Transit → Delivered\n\n"
        "📦 Each delivery includes an **AI-optimized route** for fastest pickup!",

        "📋 Delivery tracking information:\n"
        "• **Pending:** Waiting for pickup\n"
        "• **In Transit:** On the way to NGO\n"
        "• **Delivered:** Successfully completed!\n\n"
        "Check the Delivery Status page for real-time updates. 🎯"
    ],
    "analytics": [
        "📊 Your analytics dashboard shows:\n"
        "• **Total items** listed on the platform\n"
        "• **Food saved** vs **food wasted**\n"
        "• **Category breakdown** of donations\n"
        "• **Request & delivery** statistics\n\n"
        "Visit the **📈 Analytics** page for charts and detailed metrics!",

        "📈 Understanding your impact:\n"
        "• Track your **waste reduction efficiency**\n"
        "• See how much food you've **saved from landfills**\n"
        "• Compare across **food categories**\n"
        "• Monitor **monthly trends**\n\n"
        "Data-driven decisions lead to less waste! 🌱"
    ]
}

# Default response when no intent is matched
DEFAULT_RESPONSES = [
    "🤔 I'm not sure I understand. Try asking about:\n"
    "• **Expiring food** — What to do with aging items\n"
    "• **Donations** — How to donate surplus food\n"
    "• **Nearby NGOs** — Find pickup partners\n"
    "• **Waste reduction** — Tips to minimize food waste\n"
    "• **Help** — General guidance on using SustainAI",

    "❓ I didn't quite catch that. I can help with:\n"
    "• Food expiry management\n"
    "• Donation process\n"
    "• Finding nearby NGOs\n"
    "• Waste reduction strategies\n"
    "• Delivery tracking\n\n"
    "Try rephrasing your question! 😊"
]


def chatbot_reply(message):
    """
    Rule-based NLP chatbot that maps user messages to intents.

    Uses keyword matching to identify intent, then returns a contextual response.
    Selects response variation randomly for natural conversation feel.

    Input:  message (string)
    Output: {"reply": string, "intent": string}
    """
    msg_lower = message.lower().strip()

    # Score each intent based on keyword matches
    intent_scores = {}
    for intent, keywords in INTENT_KEYWORDS.items():
        score = 0
        for kw in keywords:
            if kw in msg_lower:
                score += 1
                # Bonus for exact word match
                if f" {kw} " in f" {msg_lower} ":
                    score += 0.5
        if score > 0:
            intent_scores[intent] = score

    # Pick the highest scoring intent
    if intent_scores:
        best_intent = max(intent_scores, key=intent_scores.get)
        responses = INTENT_RESPONSES.get(best_intent, DEFAULT_RESPONSES)
        # Use message hash for deterministic but varied selection
        idx = hash(message) % len(responses)
        return {"reply": responses[idx], "intent": best_intent}

    # No intent matched
    idx = hash(message) % len(DEFAULT_RESPONSES)
    return {"reply": DEFAULT_RESPONSES[idx], "intent": "unknown"}


# =============================================================================
#  MAIN CLI HANDLER
# =============================================================================

def main():
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Missing args"}))
        return

    cmd = sys.argv[1]
    data = json.loads(sys.argv[2])
    result = {}

    try:
        if cmd == "predict_expiry":
            result = predict_expiry(data["expiry"])

        elif cmd == "suggest_usage":
            result["suggestions"] = suggest_usage(data.get("items", []))

        elif cmd == "find_nearest":
            result["nearest"] = find_nearest_ngo(
                float(data["lat"]), float(data["lon"]), data.get("ngos", [])
            )

        elif cmd == "calculate_waste":
            result = calculate_waste(data.get("produced", 0), data.get("saved", 0))

        # ── NEW: A* Route Optimization ──
        elif cmd == "astar_route":
            result = astar_route(data["hotel_location"], data["ngo_location"])

        # ── NEW: Chatbot NLP ──
        elif cmd == "chatbot":
            result = chatbot_reply(data.get("message", ""))

        else:
            result["error"] = "Unknown command: " + cmd

    except Exception as e:
        result["error"] = str(e)

    print(json.dumps(result))


if __name__ == "__main__":
    main()

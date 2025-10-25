'''
Business: Manage game progress - save and load player statistics
Args: event - dict with httpMethod, body, queryStringParameters
      context - object with attributes: request_id, function_name
Returns: HTTP response dict with player stats or update confirmation
'''
import json
import os
from typing import Dict, Any
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor

def serialize_datetime(obj):
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    dsn = os.environ.get('DATABASE_URL')
    conn = psycopg2.connect(dsn)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        if method == 'GET':
            params = event.get('queryStringParameters', {})
            player_id = params.get('player_id', 'guest')
            
            cur.execute(
                "SELECT * FROM game_progress WHERE player_id = %s",
                (player_id,)
            )
            result = cur.fetchone()
            
            if not result:
                cur.execute(
                    "INSERT INTO game_progress (player_id) VALUES (%s) RETURNING *",
                    (player_id,)
                )
                conn.commit()
                result = cur.fetchone()
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps(dict(result), default=serialize_datetime)
            }
        
        if method == 'POST':
            body_data = json.loads(event.get('body', '{}'))
            player_id = body_data.get('player_id', 'guest')
            kills = body_data.get('kills', 0)
            deaths = body_data.get('deaths', 0)
            won = body_data.get('won', False)
            
            cur.execute(
                """
                UPDATE game_progress 
                SET total_kills = total_kills + %s,
                    total_deaths = total_deaths + %s,
                    wins = wins + %s,
                    losses = losses + %s,
                    experience = experience + %s,
                    updated_at = CURRENT_TIMESTAMP
                WHERE player_id = %s
                RETURNING *
                """,
                (kills, deaths, 1 if won else 0, 0 if won else 1, kills * 10, player_id)
            )
            conn.commit()
            result = cur.fetchone()
            
            if not result:
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Player not found'})
                }
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps(dict(result), default=serialize_datetime)
            }
        
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    finally:
        cur.close()
        conn.close()
import os, json, psycopg
from psycopg.rows import dict_row

DATABASE_URL=os.getenv('DATABASE_URL','postgresql://dd_agent:dd_agent_dev@postgres:5432/dd_agents')

def conn():
    return psycopg.connect(DATABASE_URL, row_factory=dict_row)

def fetch(sql, params=()):
    with conn() as c, c.cursor() as cur:
        cur.execute(sql, params); return cur.fetchall()

def fetch_one(sql, params=()):
    with conn() as c, c.cursor() as cur:
        cur.execute(sql, params); return cur.fetchone()

def execute(sql, params=()):
    with conn() as c, c.cursor() as cur:
        cur.execute(sql, params)
        row = cur.fetchone() if cur.description else None
        c.commit()
        return row

def j(value):
    return json.dumps(value, default=str)

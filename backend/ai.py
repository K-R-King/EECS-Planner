import os
from pathlib import Path

from dotenv import load_dotenv
from google import genai

load_dotenv(Path(__file__).parent / ".env")

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

def build_prompt(plan, question):
    return f"""
You are an experienced UC Berkeley EECS academic advisor.

You are helping a prospective student plan their entire undergraduate degree.

Current degree plan:
{plan}

Student question:
{question}

Only use information from the provided plan.
Be concise, accurate, and helpful.
"""


def get_ai_advice(plan, question):
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=build_prompt(plan, question),
        )

        return response.text

    except Exception as e:
        return f"Gemini Error: {e}"

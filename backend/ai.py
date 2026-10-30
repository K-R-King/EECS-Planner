import json

import anthropic
from dotenv import load_dotenv

load_dotenv()

# Reads ANTHROPIC_API_KEY from the environment (or backend/.env)
client = anthropic.Anthropic()

SYSTEM_PROMPT = """You are an experienced UC Berkeley EECS academic advisor.

You are helping a prospective student plan their entire undergraduate degree.

Only use information from the provided plan.
Be concise, accurate, and helpful."""


def build_prompt(plan, question):
    return f"""Current degree plan:
{json.dumps(plan, indent=2)}

Student question:
{question}"""


def get_ai_advice(plan, question):
    try:
        response = client.beta.messages.create(
            model="claude-opus-5-5",
            max_tokens=16000,
            output_config={"effort": "medium"},
            # if a request is declined, retry it on a fallback model
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": build_prompt(plan, question)}],
        )

    except anthropic.RateLimitError:
        return "The advisor is busy right now. Try again in a minute."
    except anthropic.APIStatusError as e:
        return f"Claude API Error ({e.status_code}): {e.message}"
    except anthropic.APIConnectionError:
        return "Couldn't reach the Claude API. Check your internet connection."

    if response.stop_reason == "refusal":
        return "The advisor couldn't answer that question."

    return "".join(block.text for block in response.content if block.type == "text")

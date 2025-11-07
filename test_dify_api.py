"""
Test Dify API directly to see the actual response structure
"""
import httpx
import json
import asyncio

api_key = "dataset-tTuWMwOLTw6Lhhmihan6uszE"
base_url = "http://kca-ai.kro.kr:5001/v1"

async def test_api():
    url = f"{base_url}/datasets"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    params = {
        "page": 1,
        "limit": 20
    }

    print("=" * 80)
    print("Testing Dify API")
    print("=" * 80)
    print(f"URL: {url}")
    print(f"Headers: {headers}")
    print(f"Params: {params}")
    print("=" * 80)
    print()

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, headers=headers, params=params)

            print(f"Status Code: {response.status_code}")
            print(f"Headers: {dict(response.headers)}")
            print()
            print("=" * 80)
            print("Response JSON:")
            print("=" * 80)

            if response.status_code == 200:
                data = response.json()
                print(json.dumps(data, indent=2, ensure_ascii=False))

                print()
                print("=" * 80)
                print("Response Structure Analysis:")
                print("=" * 80)

                if isinstance(data, dict):
                    print(f"Top-level keys: {list(data.keys())}")

                    if 'data' in data and isinstance(data['data'], list) and len(data['data']) > 0:
                        print(f"\nNumber of datasets: {len(data['data'])}")
                        print(f"\nFirst dataset keys: {list(data['data'][0].keys())}")
                        print(f"\nFirst dataset sample:")
                        print(json.dumps(data['data'][0], indent=2, ensure_ascii=False))

                        # 각 필드의 타입 확인
                        print("\n\nFirst dataset field types:")
                        for key, value in data['data'][0].items():
                            print(f"  {key}: {type(value).__name__} = {value}")
            else:
                print(f"Error: {response.text}")

    except Exception as e:
        print(f"Exception occurred: {type(e).__name__}")
        print(f"Error message: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_api())

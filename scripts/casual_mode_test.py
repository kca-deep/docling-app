#!/usr/bin/env python3
"""
일상대화 모드 임시 컬렉션 테스트
PDF 파일을 파싱하고 임시 컬렉션에 업로드 후 10건 질의응답 테스트
"""

import asyncio
import httpx
import json
import time
from pathlib import Path
from datetime import datetime

# 설정
API_BASE_URL = "http://localhost:8000"
PDF_PATH = "/data/docling-app/docs/250714_AI활용 고급교육 및 파일럿 프로젝트 추진(안).pdf"
COLLECTION_NAME = "temp-ai-education-test"

# 테스트 질의 10건 (문서 내용 기반 예상 질의)
TEST_QUERIES = [
    {"id": "Q01", "question": "AI 활용 고급교육의 목적은 무엇인가요?"},
    {"id": "Q02", "question": "파일럿 프로젝트 추진 일정은 어떻게 되나요?"},
    {"id": "Q03", "question": "교육 대상자는 누구인가요?"},
    {"id": "Q04", "question": "AI 교육 과정의 주요 내용은 무엇인가요?"},
    {"id": "Q05", "question": "프로젝트 예산은 얼마인가요?"},
    {"id": "Q06", "question": "교육 장소는 어디인가요?"},
    {"id": "Q07", "question": "기대효과는 무엇인가요?"},
    {"id": "Q08", "question": "추진 체계는 어떻게 구성되어 있나요?"},
    {"id": "Q09", "question": "향후 계획은 어떻게 되나요?"},
    {"id": "Q10", "question": "참여 기관은 어디인가요?"},
]


async def parse_document(file_path: str) -> dict:
    """문서 파싱 (Docling Serve 직접 호출)"""
    print(f"\n[1/3] 문서 파싱 중: {Path(file_path).name}")

    docling_url = "http://ai.kca.kr:8007"

    async with httpx.AsyncClient(timeout=300.0) as client:
        # 1. 파일 업로드 및 변환 요청
        with open(file_path, "rb") as f:
            file_content = f.read()

        files = {"files": (Path(file_path).name, file_content, "application/pdf")}
        data = {
            "target_type": "inbody",
            "to_formats": ["md"],
            "do_ocr": True,
            "do_table_structure": True,
            "include_images": False,
            "table_mode": "accurate",
            "pipeline": "standard"
        }
        response = await client.post(
            f"{docling_url}/v1/convert/file/async",
            files=files,
            data=data
        )

        if response.status_code != 200:
            print(f"  파싱 요청 실패: {response.status_code}")
            return None

        result = response.json()
        task_id = result.get("task_id")
        print(f"  Task ID: {task_id}")

        # 2. 상태 폴링
        while True:
            status_response = await client.get(
                f"{docling_url}/v1/status/poll/{task_id}?wait=2"
            )
            status = status_response.json()

            if status.get("status") == "SUCCESS":
                print("  파싱 완료!")
                break
            elif status.get("status") == "FAILURE":
                print(f"  파싱 실패: {status}")
                return None

            print(f"  상태: {status.get('status')}...")
            await asyncio.sleep(2)

        # 3. 결과 가져오기
        result_response = await client.get(f"{docling_url}/v1/result/{task_id}")
        result_data = result_response.json()

        markdown = result_data.get("document", {}).get("md_content", "")
        print(f"  마크다운 길이: {len(markdown)} 자")

        return {"markdown": markdown, "filename": Path(file_path).name}


async def create_collection_and_upload(doc_data: dict, collection_name: str) -> bool:
    """컬렉션 생성 및 문서 업로드"""
    print(f"\n[2/3] 컬렉션 생성 및 업로드: {collection_name}")

    qdrant_url = "http://ai.kca.kr:6333"
    embedding_url = "http://ai.kca.kr:8083"
    chunking_url = "http://ai.kca.kr:8007"

    async with httpx.AsyncClient(timeout=120.0) as client:
        # 1. 기존 컬렉션 삭제 (있으면)
        try:
            await client.delete(f"{qdrant_url}/collections/{collection_name}")
            print(f"  기존 컬렉션 삭제")
        except:
            pass

        # 2. 컬렉션 생성
        create_payload = {
            "vectors": {
                "size": 1024,
                "distance": "Cosine"
            }
        }
        response = await client.put(
            f"{qdrant_url}/collections/{collection_name}",
            json=create_payload
        )
        print(f"  컬렉션 생성: {response.status_code}")

        # 3. 청킹
        chunk_payload = {
            "text": doc_data["markdown"],
            "chunk_size": 500,
            "chunk_overlap": 50
        }
        chunk_response = await client.post(
            f"{chunking_url}/v1/chunk",
            json=chunk_payload
        )

        if chunk_response.status_code != 200:
            # 간단한 청킹 폴백
            chunks = [doc_data["markdown"][i:i+500] for i in range(0, len(doc_data["markdown"]), 450)]
        else:
            chunks = chunk_response.json().get("chunks", [])

        print(f"  청크 수: {len(chunks)}")

        # 4. 임베딩 생성 및 업로드
        points = []
        for i, chunk in enumerate(chunks):
            chunk_text = chunk if isinstance(chunk, str) else chunk.get("text", str(chunk))

            # 임베딩 생성
            embed_response = await client.post(
                f"{embedding_url}/v1/embeddings",
                json={"input": chunk_text, "model": "bge-m3-korean"}
            )

            if embed_response.status_code == 200:
                embedding = embed_response.json()["data"][0]["embedding"]
                points.append({
                    "id": i + 1,
                    "vector": embedding,
                    "payload": {
                        "text": chunk_text[:1000],
                        "document_name": doc_data["filename"],
                        "chunk_index": i,
                        "page_number": 1
                    }
                })

            if (i + 1) % 10 == 0:
                print(f"  임베딩 생성: {i + 1}/{len(chunks)}")

        # 5. Qdrant에 업로드
        if points:
            upload_response = await client.put(
                f"{qdrant_url}/collections/{collection_name}/points",
                json={"points": points}
            )
            print(f"  업로드 완료: {len(points)}개 포인트")

        return True


async def test_queries(collection_name: str, queries: list) -> list:
    """질의응답 테스트"""
    print(f"\n[3/3] 질의응답 테스트 ({len(queries)}건)")

    results = []

    async with httpx.AsyncClient(timeout=180.0) as client:
        for q in queries:
            print(f"\n  [{q['id']}] {q['question']}")

            start_time = time.time()

            try:
                # Chat API 호출
                payload = {
                    "collection_name": collection_name,
                    "message": q["question"],
                    "model": "gpt-oss-20b",
                    "reasoning_level": "medium",
                    "temperature": 0.7,
                    "max_tokens": 1024,
                    "top_k": 5,
                    "use_reranking": True
                }

                response = await client.post(
                    f"{API_BASE_URL}/api/chat/",
                    json=payload
                )

                elapsed = time.time() - start_time

                if response.status_code == 200:
                    data = response.json()
                    answer = data.get("answer", "")[:200]
                    sources = data.get("retrieved_docs", [])
                    avg_score = sum(s.get("score", 0) for s in sources) / len(sources) if sources else 0

                    result = {
                        "id": q["id"],
                        "question": q["question"],
                        "answer": answer + "..." if len(data.get("answer", "")) > 200 else data.get("answer", ""),
                        "source_count": len(sources),
                        "avg_score": avg_score,
                        "elapsed": elapsed,
                        "status": "success"
                    }

                    print(f"    응답 ({elapsed:.1f}초, 출처점수: {avg_score:.3f})")
                    print(f"    {answer[:100]}...")
                else:
                    result = {
                        "id": q["id"],
                        "question": q["question"],
                        "answer": "",
                        "source_count": 0,
                        "avg_score": 0,
                        "elapsed": elapsed,
                        "status": f"error: {response.status_code}"
                    }
                    print(f"    오류: {response.status_code}")

            except Exception as e:
                result = {
                    "id": q["id"],
                    "question": q["question"],
                    "answer": "",
                    "source_count": 0,
                    "avg_score": 0,
                    "elapsed": 0,
                    "status": f"exception: {str(e)}"
                }
                print(f"    예외: {e}")

            results.append(result)

    return results


def print_summary(results: list):
    """결과 요약 출력"""
    print("\n" + "="*60)
    print("테스트 결과 요약")
    print("="*60)

    success = len([r for r in results if r["status"] == "success"])
    total = len(results)
    avg_time = sum(r["elapsed"] for r in results) / total if total > 0 else 0
    avg_score = sum(r["avg_score"] for r in results if r["status"] == "success") / success if success > 0 else 0

    print(f"성공률: {success}/{total} ({success/total*100:.1f}%)")
    print(f"평균 응답시간: {avg_time:.2f}초")
    print(f"평균 출처점수: {avg_score:.3f}")

    print("\n상세 결과:")
    print("-"*60)
    for r in results:
        status = "O" if r["status"] == "success" else "X"
        print(f"[{status}] {r['id']}: {r['question'][:30]}... (점수: {r['avg_score']:.3f}, {r['elapsed']:.1f}초)")

    return {
        "success_rate": success / total if total > 0 else 0,
        "avg_time": avg_time,
        "avg_score": avg_score,
        "results": results
    }


async def main():
    """메인 실행"""
    print("="*60)
    print("일상대화 모드 임시 컬렉션 테스트")
    print(f"시작: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*60)

    # 1. 문서 파싱
    doc_data = await parse_document(PDF_PATH)
    if not doc_data:
        print("문서 파싱 실패!")
        return

    # 2. 컬렉션 생성 및 업로드
    success = await create_collection_and_upload(doc_data, COLLECTION_NAME)
    if not success:
        print("업로드 실패!")
        return

    # 3. 질의응답 테스트
    results = await test_queries(COLLECTION_NAME, TEST_QUERIES)

    # 4. 결과 요약
    summary = print_summary(results)

    # 5. 결과 저장
    output_path = Path("/data/docling-app/docs/final/casual_mode_test_result.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump({
            "test_date": datetime.now().isoformat(),
            "collection": COLLECTION_NAME,
            "document": PDF_PATH,
            "summary": {
                "success_rate": summary["success_rate"],
                "avg_time": summary["avg_time"],
                "avg_score": summary["avg_score"]
            },
            "results": summary["results"]
        }, f, ensure_ascii=False, indent=2)

    print(f"\n결과 저장: {output_path}")
    print(f"\n완료: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


if __name__ == "__main__":
    asyncio.run(main())

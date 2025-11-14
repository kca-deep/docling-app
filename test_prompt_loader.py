"""
PromptLoader 테스트 스크립트
컬렉션별 시스템 프롬프트 로딩이 제대로 작동하는지 확인
"""
from backend.services.prompt_loader import PromptLoader


def test_prompt_loader():
    """PromptLoader 기본 기능 테스트"""
    print("=" * 80)
    print("PromptLoader 테스트 시작")
    print("=" * 80)

    # PromptLoader 초기화
    loader = PromptLoader()
    print(f"\n[1] PromptLoader 초기화 완료")
    print(f"   - Prompts directory: {loader.prompts_dir}")

    # 테스트 1: default.md 로드 (collection_name=None)
    print("\n[2] 테스트 1: collection_name=None (default.md 사용)")
    prompt1 = loader.get_system_prompt(collection_name=None, reasoning_level="medium")
    print(f"   - Prompt length: {len(prompt1)} chars")
    print(f"   - Contains '문서 기반 질의응답': {'문서 기반 질의응답' in prompt1}")
    print(f"   - Placeholder replaced: {'{reasoning_instruction}' not in prompt1}")
    if '{reasoning_instruction}' not in prompt1:
        print(f"   [OK] Reasoning instruction applied correctly")
    print(f"\n   Preview (first 200 chars):\n   {prompt1[:200]}")

    # 테스트 2: regulation.md 로드 (collection_name="regulation_docs")
    print("\n[3] 테스트 2: collection_name='regulation_docs' (regulation.md 사용)")
    prompt2 = loader.get_system_prompt(collection_name="regulation_docs", reasoning_level="high")
    print(f"   - Prompt length: {len(prompt2)} chars")
    print(f"   - Contains '복무 규정': {'복무 규정' in prompt2}")
    print(f"   - Contains '한국방송통신전파진흥원': {'한국방송통신전파진흥원' in prompt2}")
    print(f"   - Placeholder replaced: {'{reasoning_instruction}' not in prompt2}")
    if '{reasoning_instruction}' not in prompt2:
        print(f"   [OK] Reasoning instruction applied correctly")
    print(f"\n   Preview (first 300 chars):\n   {prompt2[:300]}")

    # 테스트 3: 존재하지 않는 컬렉션 (fallback to default.md)
    print("\n[4] 테스트 3: collection_name='nonexistent' (fallback to default.md)")
    prompt3 = loader.get_system_prompt(collection_name="nonexistent", reasoning_level="low")
    print(f"   - Prompt length: {len(prompt3)} chars")
    print(f"   - Same as default prompt: {len(prompt3) == len(prompt1)}")
    if len(prompt3) == len(prompt1):
        print(f"   [OK] Fallback to default.md successful")

    # 테스트 4: reasoning_level 변화 확인
    print("\n[5] 테스트 4: reasoning_level 변화 확인")
    prompt_low = loader.get_system_prompt(collection_name=None, reasoning_level="low")
    prompt_medium = loader.get_system_prompt(collection_name=None, reasoning_level="medium")
    prompt_high = loader.get_system_prompt(collection_name=None, reasoning_level="high")

    print(f"   - Low contains '간단하고 명확': {'간단하고 명확' in prompt_low}")
    print(f"   - Medium contains '적절한 수준': {'적절한 수준' in prompt_medium}")
    print(f"   - High contains '깊이 있는 분석': {'깊이 있는 분석' in prompt_high}")

    if '간단하고 명확' in prompt_low and '적절한 수준' in prompt_medium and '깊이 있는 분석' in prompt_high:
        print(f"   [OK] Reasoning level applied correctly for all levels")

    # 테스트 5: mapping.json 로드 확인
    print("\n[6] 테스트 5: mapping.json 로드 확인")
    mapping = loader._load_mapping()
    print(f"   - Mapping loaded: {mapping is not None}")
    print(f"   - Collections in mapping: {list(mapping.get('collection_prompts', {}).keys())}")
    print(f"   - Default prompt: {mapping.get('default_prompt')}")
    if 'regulation_docs' in mapping.get('collection_prompts', {}):
        print(f"   [OK] regulation_docs mapping found")
        reg_config = mapping['collection_prompts']['regulation_docs']
        print(f"   - Prompt file: {reg_config.get('prompt_file')}")
        print(f"   - Description: {reg_config.get('description')}")

    # 캐싱 테스트
    print("\n[7] 테스트 6: 캐싱 확인")
    print(f"   - Cache size before: {len(loader.cache)}")
    loader.get_system_prompt(collection_name="regulation_docs", reasoning_level="medium")
    print(f"   - Cache size after: {len(loader.cache)}")
    if len(loader.cache) > 0:
        print(f"   [OK] Caching works correctly")
        print(f"   - Cached files: {list(loader.cache.keys())}")

    print("\n" + "=" * 80)
    print("PromptLoader 테스트 완료")
    print("=" * 80)


if __name__ == "__main__":
    test_prompt_loader()

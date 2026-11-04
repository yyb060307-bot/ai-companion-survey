/**
 * 설문 설정
 * ------------------------------------------------------------
 * 이 파일의 값만 바꿔도 페이지 흐름, 챗봇 캐릭터, 최소 대화 조건,
 * LLM 제공자, 경품 추첨 링크를 교체할 수 있도록 구성했습니다.
 */
(function (S) {
  S.config = {
    title: 'AI 챗봇 사용 경험 설문',
    subtitle: '캐릭터 기반 AI 챗봇과의 대화 경험과 심리적 지표',
    version: '0.1.0-test',
    testMode: true,

    // 테스트 모드에서는 3회 발화 후 대화를 종료할 수 있습니다.
    // 실제 연구에서는 연구 설계에 맞춰 조정하세요.
    minUserTurns: 3,

    likertLabels: ['전혀 아니다', '아니다', '보통이다', '그렇다', '매우 그렇다'],

    // 사용 시간·기간, 사회적 관계망은 5점 척도로 측정합니다.
    usageTimeLabels: ['1시간 미만', '1~3시간', '3~7시간', '7~14시간', '14시간 이상'],
    usagePeriodLabels: ['1개월 미만', '1~6개월', '6개월~1년', '1~2년', '2년 이상'],
    networkMeetLabels: ['없다', '1명', '2~3명', '4~5명', '6명 이상'],
    networkContactLabels: ['10분 미만', '10~30분', '30분~1시간', '1~2시간', '2시간 이상'],

    character: {
      id: 'haru',
      name: '하루',
      tagline: '차분하게 이야기를 들어주는 대화 상대',
      avatar: '하',
      greeting: '안녕하세요, 저는 하루예요. 오늘은 어떤 이야기를 나눠볼까요?',
    },

    llm: {
      // 'mock' | 'claude'
      provider: 'mock',
      // 실제 연동 시 사용할 모델 예시. 서버 프록시에서 호출하세요.
      // Haiku를 사용할 경우: 'claude-haiku-...' 형태로 교체
      model: 'claude-sonnet-5-5',
      maxTokens: 512,
      temperature: 0.8,
    },

    // 테스트용 자리표시자입니다. 실제 추첨 설문 URL로 교체하세요.
    raffleUrl: 'https://forms.gle/REPLACE_ME',
  };

  /**
   * 사전·사후 검사에서 공통으로 사용하는 심리 지표 구성입니다.
   * 실제 척도 문항과 채점 방식은 확정 후 이 데이터만 교체하면 됩니다.
   * preItem/postItem은 UI 확인용 예시 문항입니다.
   */
  S.psychConstructs = [
    {
      key: 'loneliness',
      preItem: 'AI를 본격적으로 사용하기 전에는 외로움이나 고립감을 느꼈다.',
      postItem: '나는 현재 외로움이나 고립감을 느낀다.',
    },
    {
      key: 'support',
      preItem: 'AI를 본격적으로 사용하기 전에는 어려울 때 의지하거나 도움을 요청할 수 있는 사람이 있었다.',
      postItem: '나는 현재 어려울 때 의지하거나 도움을 요청할 수 있는 사람이 있다.',
    },
    {
      key: 'baseline',
      preItem: 'AI를 본격적으로 사용하기 전에는 전반적인 심리 상태가 안정적이었다.',
      postItem: '나는 현재 전반적인 심리 상태가 안정적이라고 느낀다.',
    },
  ];

  /** AI 사용 경험 평가 문항 (UI 확인용 예시) */
  S.evaluationItems = [
    { key: 'immersion', item: '챗봇과 대화하는 동안 대화에 집중했다.' },
    { key: 'closeness', item: '캐릭터에게 정서적 친밀감을 느꼈다.' },
    { key: 'empathy', item: '캐릭터가 내 감정을 이해한다고 느꼈다.' },
    { key: 'relief', item: '챗봇과의 대화 후 외로움이 줄어든 느낌이 들었다.' },
    { key: 'continueDesire', item: '대화가 끝난 후에도 캐릭터와 더 이야기하고 싶었다.' },
  ];

  /** 사전 검사 선택지 */
  S.preAIOptions = {
    purposes: ['작업', '오락', '사회·관계', '호기심', '기타'],
    perceptions: ['업무·학습 도구', '정보 검색 도구', '대화 상대', '정서적 지지 대상', '기타'],
  };

  /** 페이지 메타데이터 */
  S.pageMeta = [
    { id: 'intro', kicker: 'Introduction', title: '설문 안내', nav: '설문 시작' },
    { id: 'pre-ai', kicker: 'Pre-test 01', title: 'AI 사용 경험', nav: '다음' },
    { id: 'pre-psych', kicker: 'Pre-test 02', title: 'AI 경험 전 심리 상태', nav: '다음' },
    { id: 'post-psych', kicker: 'Post-test', title: '현재 심리 상태', nav: '다음' },
    { id: 'chat', kicker: 'Conversation', title: 'AI 챗봇 대화', nav: '다음 단계' },
    { id: 'evaluation', kicker: 'Evaluation', title: 'AI 챗봇 경험 평가', nav: '다음' },
    { id: 'ending', kicker: 'Ending', title: '설문 완료', nav: '완료' },
  ];
})(window.Survey = window.Survey || {});

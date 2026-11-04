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

    // 4점 척도에 "보통임"을 추가한 5점 척도
    likertLabels: ['매우 그렇지 않음', '다소 그렇지 않음', '보통임', '다소 그러함', '매우 그러함'],
    psychLabels: ['매우 그렇지 않음', '다소 그렇지 않음', '다소 그러함', '매우 그러함'],
    selfDisclosureLabels: ['전혀 하지 않음', '거의 하지 않음', '보통임', '자주 함', '매우 자주 함'],

    usageTimeOptions: ['30분 미만', '30분 이상~1시간 미만', '1시간 이상~3시간 미만', '3시간 이상~6시간 미만', '6시간 이상'],
    usagePeriodOptions: ['3개월 미만', '3개월 이상~6개월 미만', '6개월 이상~1년 미만', '1년 이상~2년 미만', '2년 이상~3년 미만', '3년 이상'],
    networkMeetOptions: ['0명', '1-2명', '3-4명', '5-8명', '9명 이상'],
    networkContactOptions: ['한 달에 1회 미만', '한 달에 1번', '한 달에 2-3번', '매주', '1주일에 2-3회', '거의 매일'],

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
   * 사전·사후 검사에서 공통으로 사용하는 심리사회 문항입니다.
   * 4점 척도(psychLabels)로 측정합니다.
   */
  S.psychConstructs = [
    { key: 'loneliness', item: '나는 외롭다고 느낀다.' },
    { key: 'isolation', item: '나는 소외되어 있다고 느낀다.' },
    {
      key: 'disclosure',
      item: '나는 가족이나 친구들에게 편하게 의지하고 사적인 문제를 털어놓고 얘기하기도 한다.',
    },
    { key: 'support', item: '나는 필요할 때 도움을 청할 수 있는 사람이 있다.' },
  ];

  /** 챗봇 이용 후기 문항 (5점 척도) */
  S.evaluationItems = [
    { key: 'immersion', item: '챗봇과 대화하는 동안 대화에 집중했습니다.' },
    { key: 'closeness', item: '캐릭터에게 정서적 친밀감을 느꼈습니다.' },
    { key: 'empathy', item: '캐릭터가 제 감정을 이해한다고 느꼈습니다.' },
    { key: 'relief', item: '챗봇과의 대화 후 외로움이 줄어든 느낌이 들었습니다.' },
    { key: 'continueDesire', item: '대화가 끝난 후에도 캐릭터와 더 이야기하고 싶었습니다.' },
  ];

  /** 사전 검사 선택지 */
  S.preAIOptions = {
    purposes: ['작업', '오락', '사회·관계', '호기심', '기타'],
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

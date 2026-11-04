/**
 * 저장 어댑터 (스텁)
 * ------------------------------------------------------------
 * 현재는 실제 저장을 하지 않고 콘솔에만 남깁니다.
 * Supabase를 붙일 때 이 파일의 메서드 내부만 교체하면 됩니다.
 *
 * 예시:
 *   const { data, error } = await supabase
 *     .from('survey_responses')
 *     .insert({ response_id, page_id, payload });
 */
(function (S) {
  S.services = S.services || {};

  S.services.storage = {
    async savePage(pageId, payload) {
      console.info('[storage:stub] page saved', pageId, payload);
      return { ok: true, persisted: false };
    },

    async saveChatBehavior(payload) {
      console.info('[storage:stub] chat behavior saved', payload);
      return { ok: true, persisted: false };
    },

    async saveCompletion(payload) {
      console.info('[storage:stub] completion saved', payload);
      return { ok: true, persisted: false };
    },
  };
})(window.Survey = window.Survey || {});

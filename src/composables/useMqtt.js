import { computed, onBeforeUnmount, ref } from 'vue'

export function useMqtt() {
  const status = ref('deprecated')
  const errorMessage = ref('旧前端 MQTT 直连链路已停用，请使用 usePetApi() 通过 moodpaws-server 获取数据。')
  const latestPayloadText = ref('')

  const statusText = computed(() => 'Deprecated')
  const sourceSummary = computed(() => [
    { label: 'Topic', value: '--' },
    { label: 'Last Source Device', value: '--' },
    { label: 'Request ID', value: '--' },
    { label: 'Created At', value: '--' }
  ])
  const metricSections = computed(() => [])

  function connect() {}
  function disconnect() {}
  function clearPayload() {
    latestPayloadText.value = ''
  }

  onBeforeUnmount(() => {
    disconnect()
  })

  return {
    brokerUrl: '',
    topic: '',
    status,
    statusText,
    errorMessage,
    latestPayloadText,
    sourceSummary,
    metricSections,
    connect,
    disconnect,
    clearPayload
  }
}

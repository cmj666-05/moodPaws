import { computed, onBeforeUnmount, ref } from 'vue'
import { createMqttClient } from '../services/mqtt/client'
import { mqttConfig } from '../services/mqtt/config'
import { getEmptyDashboardData, parseDashboardPayload } from '../utils/pet-house-parser'

export function useMqtt() {
  const client = ref(null)
  const status = ref('idle')
  const errorMessage = ref('')
  const latestTopic = ref('')
  const latestPayloadText = ref('')
  const latestPayload = ref(getEmptyDashboardData())

  const statusText = computed(() => {
    if (status.value === 'subscribed') return 'Connected and subscribed'
    if (status.value === 'connected') return 'Connected'
    if (status.value === 'connecting') return 'Connecting'
    if (status.value === 'error') return 'Error'
    return 'Idle'
  })

  const sourceSummary = computed(() => {
    if (!latestPayload.value) {
      return [
        { label: 'Topic', value: mqttConfig.topic },
        { label: 'Last Source Device', value: '--' },
        { label: 'Request ID', value: '--' },
        { label: 'Created At', value: '--' }
      ]
    }

    return [
      { label: 'Topic', value: latestTopic.value || mqttConfig.topic },
      { label: 'Last Source Device', value: latestPayload.value.source.deviceName },
      { label: 'Request ID', value: latestPayload.value.source.requestId },
      { label: 'Created At', value: latestPayload.value.source.createdAt }
    ]
  })

  const metricSections = computed(() => latestPayload.value.sections)

  function connect() {
    disconnect()
    status.value = 'connecting'
    errorMessage.value = ''

    const nextClient = createMqttClient({
      onConnect(activeClient) {
        status.value = 'connected'
        client.value = activeClient
        activeClient.subscribe(mqttConfig.topic, { qos: 0 }, (error) => {
          if (error) {
            status.value = 'error'
            errorMessage.value = `Subscribe failed: ${error.message}`
            return
          }

          status.value = 'subscribed'
        })
      },
      onMessage(messageTopic, payload) {
        latestTopic.value = messageTopic
        latestPayloadText.value = payload.toString()

        try {
          latestPayload.value = parseDashboardPayload(latestPayloadText.value, latestPayload.value)
          errorMessage.value = ''
        } catch (error) {
          errorMessage.value = `Payload parse failed: ${error.message}`
        }
      },
      onReconnect() {
        status.value = 'connecting'
      },
      onClose() {
        if (status.value !== 'idle') {
          status.value = 'connecting'
        }
      },
      onError(error) {
        status.value = 'error'
        errorMessage.value = error.message
      }
    })

    client.value = nextClient
  }

  function disconnect() {
    if (client.value) {
      client.value.end(true)
      client.value = null
    }

    status.value = 'idle'
  }

  function clearPayload() {
    latestTopic.value = ''
    latestPayloadText.value = ''
    latestPayload.value = getEmptyDashboardData()
    errorMessage.value = ''
  }

  onBeforeUnmount(() => {
    disconnect()
  })

  return {
    brokerUrl: mqttConfig.brokerUrl,
    topic: mqttConfig.topic,
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

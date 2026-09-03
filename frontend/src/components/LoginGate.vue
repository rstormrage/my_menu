<template>
  <div class="gate">
    <form class="sheet" @submit.prevent="submit">
      <p class="eyebrow">个人菜单</p>
      <h2>输入密码</h2>
      <p class="gate-hint">这是私人菜单，输入密码后才能查看。</p>
      <label>
        密码
        <input
          ref="inputEl"
          v-model="password"
          type="password"
          inputmode="numeric"
          autocomplete="current-password"
          placeholder="请输入访问密码"
        />
      </label>
      <p v-if="error" class="err">{{ error }}</p>
      <button type="submit" class="btn primary" :disabled="submitting">
        {{ submitting ? '正在验证…' : '进入菜单' }}
      </button>
    </form>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { api } from '../api.js'
import { setToken } from '../auth.js'

const emit = defineEmits(['unlocked'])

const password = ref('')
const error = ref('')
const inputEl = ref(null)
const submitting = ref(false)

onMounted(() => {
  inputEl.value?.focus()
})

async function submit() {
  error.value = ''
  submitting.value = true
  try {
    const data = await api.login(password.value)
    setToken(data.token)
    emit('unlocked')
  } catch (err) {
    error.value = err.message
    password.value = ''
    inputEl.value?.focus()
  } finally {
    submitting.value = false
  }
}
</script>

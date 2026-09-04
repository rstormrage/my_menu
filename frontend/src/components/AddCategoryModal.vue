<template>
  <div class="mask" @click.self="$emit('close')">
    <form class="sheet" @submit.prevent="save">
      <h2>新分类</h2>
      <label>
        名称
        <input v-model="name" maxlength="20" placeholder="比如：日料" required />
      </label>
      <label>
        图标
        <input v-model="emoji" maxlength="4" placeholder="🍣" />
      </label>
      <p v-if="error" class="err">{{ error }}</p>
      <div class="row">
        <button type="button" class="btn ghost" @click="$emit('close')">取消</button>
        <button type="submit" class="btn primary" :disabled="saving">{{ saving ? '保存中…' : '添加分类' }}</button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { api } from '../api.js'

const props = defineProps({
  kind: { type: String, default: 'home' },
})
const emit = defineEmits(['close', 'saved'])
const name = ref('')
const emoji = ref('🍽️')
const saving = ref(false)
const error = ref('')

async function save() {
  error.value = ''
  saving.value = true
  try {
    const row = await api.addCategory({ name: name.value, emoji: emoji.value, kind: props.kind })
    emit('saved', row)
  } catch (err) {
    error.value = err.message
  } finally {
    saving.value = false
  }
}
</script>

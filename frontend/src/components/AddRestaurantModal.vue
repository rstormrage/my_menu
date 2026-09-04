<template>
  <div class="mask" @click.self="$emit('close')">
    <form class="sheet wide" @submit.prevent="save">
      <h2>添加馆子</h2>
      <label>
        馆子名
        <input v-model="name" maxlength="40" placeholder="比如：巷口烧烤" required />
      </label>
      <label>
        分类
        <select v-model="categoryId" required>
          <option disabled value="">请选择</option>
          <option v-for="cat in categories" :key="cat.id" :value="cat.id">
            {{ cat.emoji }} {{ cat.name }}
          </option>
        </select>
      </label>
      <label>
        这家好吃的菜
        <input v-model="hits" maxlength="80" placeholder="比如：羊肉串、烤茄子、韭菜" />
      </label>
      <label>
        离家距离（公里）
        <input v-model="distanceKm" type="number" min="0" step="0.1" placeholder="比如：0.8" required />
      </label>
      <label>
        人均花费（元）
        <input v-model="cost" type="number" min="0" step="1" placeholder="比如：60" required />
      </label>
      <label>
        备注（可选）
        <input v-model="note" maxlength="80" placeholder="排队、营业时间、适合几个人…" />
      </label>
      <p v-if="error" class="err">{{ error }}</p>
      <div class="row">
        <button type="button" class="btn ghost" @click="$emit('close')">取消</button>
        <button type="submit" class="btn primary" :disabled="saving">
          {{ saving ? '保存中…' : '加入名单' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { api } from '../api.js'

const props = defineProps({
  categories: { type: Array, default: () => [] },
  defaultCategoryId: { type: Number, default: null },
})

const emit = defineEmits(['close', 'saved'])

const name = ref('')
const hits = ref('')
const note = ref('')
const distanceKm = ref('')
const cost = ref('')
const categoryId = ref(props.defaultCategoryId || '')
const saving = ref(false)
const error = ref('')

async function save() {
  error.value = ''
  saving.value = true
  try {
    const row = await api.addRestaurant({
      name: name.value,
      hits: hits.value,
      note: note.value,
      category_id: Number(categoryId.value),
      distance_km: Number(distanceKm.value),
      cost: Number(cost.value),
    })
    emit('saved', row)
  } catch (err) {
    error.value = err.message
  } finally {
    saving.value = false
  }
}
</script>

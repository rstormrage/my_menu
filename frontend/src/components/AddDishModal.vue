<template>
  <div class="mask" @click.self="$emit('close')">
    <form class="sheet wide" @submit.prevent="save">
      <h2>添加菜品</h2>
      <label>
        菜名
        <input v-model="name" maxlength="40" placeholder="比如：蒜蓉生菜" required />
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
        备注（可选）
        <input v-model="note" maxlength="80" placeholder="想吃的理由、口味提示…" />
      </label>
      <label>
        食谱
        <textarea v-model="recipe" rows="4" maxlength="400" placeholder="简要写清步骤，比如焯水、调味、炒多久" />
      </label>
      <p v-if="error" class="err">{{ error }}</p>
      <div class="row">
        <button type="button" class="btn ghost" @click="$emit('close')">取消</button>
        <button type="submit" class="btn primary" :disabled="saving">{{ saving ? '保存中…' : '加入菜单' }}</button>
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
const note = ref('')
const recipe = ref('')
const categoryId = ref(props.defaultCategoryId || '')
const saving = ref(false)
const error = ref('')

async function save() {
  error.value = ''
  saving.value = true
  try {
    const row = await api.addDish({
      name: name.value,
      note: note.value,
      recipe: recipe.value,
      category_id: Number(categoryId.value),
    })
    emit('saved', row)
  } catch (err) {
    error.value = err.message
  } finally {
    saving.value = false
  }
}
</script>

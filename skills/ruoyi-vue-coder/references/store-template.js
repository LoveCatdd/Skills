import { defineStore } from 'pinia'
import { {{LIST_API}} } from '@/api/{{API_MODULE}}'

const use{{STORE_NAME}}Store = defineStore('{{STORE_KEY}}', {
  state: () => ({
    cache: null,
    loading: false
  }),
  actions: {
    async fetchData(params) {
      this.loading = true
      try {
        const res = await {{LIST_API}}(params)
        this.cache = res.rows
        return res
      } finally {
        this.loading = false
      }
    },
    clearCache() {
      this.cache = null
    }
  }
})

export default use{{STORE_NAME}}Store

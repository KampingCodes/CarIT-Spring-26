import { defineStore } from 'pinia'

export const useQuestionsStore = defineStore('questions', {
  state: () => ({
    contextKey: null,
    questions: [],
    userAnswers: {},
    customAnswers: {},
  }),
  actions: {
    setQuestions(contextKey, questions) {
      this.contextKey = contextKey
      this.questions = questions
      this.userAnswers = {}
      this.customAnswers = {}
    },
    updateAnswers(userAnswers, customAnswers) {
      this.userAnswers = { ...userAnswers }
      this.customAnswers = { ...customAnswers }
    },
    hasQuestionsFor(contextKey) {
      return this.contextKey === contextKey && this.questions.length > 0
    },
    clear() {
      this.contextKey = null
      this.questions = []
      this.userAnswers = {}
      this.customAnswers = {}
    }
  }
})

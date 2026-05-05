type ValidationRule = (value: unknown) => true | string

interface ValidationRules {
  [field: string]: ValidationRule[]
}

export function useFormValidation() {
  const errors = reactive<Record<string, string>>({})

  // Common validation rules
  const rules = {
    required: (value: unknown): true | string => {
      if (value === null || value === undefined || value === '') return 'This field is required'
      if (Array.isArray(value) && value.length === 0) return 'This field is required'
      return true
    },

    email: (value: unknown): true | string => {
      const str = value as string
      if (!str) return true // Let required handle empty
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      return emailRegex.test(str) || 'Please enter a valid email address'
    },

    url: (value: unknown): true | string => {
      const str = value as string
      if (!str) return true // Let required handle empty
      const urlRegex = /^https?:\/\/.+/
      return urlRegex.test(str) || 'Please enter a valid URL'
    },

    minLength: (min: number): ValidationRule => {
      return (value: unknown): true | string => {
        const str = value as string
        if (!str) return true // Let required handle empty
        return str.length >= min || `Must be at least ${min} characters`
      }
    },

    maxLength: (max: number): ValidationRule => {
      return (value: unknown): true | string => {
        const str = value as string
        if (!str) return true
        return str.length <= max || `Must be no more than ${max} characters`
      }
    },

    match: (fieldName: string, getValue: () => unknown): ValidationRule => {
      return (value: unknown): true | string => {
        return value === getValue() || `${fieldName} does not match`
      }
    },

    numeric: (value: unknown): true | string => {
      if (value === null || value === undefined || value === '') return true
      return !isNaN(Number(value)) || 'Must be a number'
    },

    positiveNumber: (value: unknown): true | string => {
      if (value === null || value === undefined || value === '') return true
      const num = Number(value)
      return (!isNaN(num) && num > 0) || 'Must be a positive number'
    }
  }

  // Get nested value from object using dot notation
  function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current: unknown, key: string) => {
      if (current && typeof current === 'object' && key in current) {
        return (current as Record<string, unknown>)[key]
      }
      return undefined
    }, obj as unknown)
  }

  // Validate form against rules
  function validate(form: Record<string, unknown>, fieldRules: ValidationRules): boolean {
    // Clear previous errors
    Object.keys(errors).forEach((key) => Reflect.deleteProperty(errors, key))

    let isValid = true

    for (const [field, rules] of Object.entries(fieldRules)) {
      const value = getNestedValue(form, field)

      for (const rule of rules) {
        const result = rule(value)
        if (result !== true) {
          errors[field] = result
          isValid = false
          break // Stop at first error for this field
        }
      }
    }

    return isValid
  }

  // Set a specific field error (e.g., from API response)
  function setFieldError(field: string, message: string): void {
    errors[field] = message
  }

  // Set multiple field errors at once (e.g., from API response)
  function setErrors(fieldErrors: Record<string, string>): void {
    Object.entries(fieldErrors).forEach(([field, message]) => {
      errors[field] = message
    })
  }

  // Clear all errors
  function clearErrors(): void {
    Object.keys(errors).forEach((key) => Reflect.deleteProperty(errors, key))
  }

  // Clear a specific field error
  function clearFieldError(field: string): void {
    Reflect.deleteProperty(errors, field)
  }

  // Check if form has any errors
  function hasErrors(): boolean {
    return Object.keys(errors).length > 0
  }

  return {
    errors,
    rules,
    validate,
    setFieldError,
    setErrors,
    clearErrors,
    clearFieldError,
    hasErrors
  }
}

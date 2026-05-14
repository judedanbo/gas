import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { computed, ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useDateTimePicker } from '~/composables/useDateTimePicker'

vi.stubGlobal('computed', computed)
vi.stubGlobal('ref', ref)
vi.stubGlobal('watch', watch)
vi.stubGlobal('nextTick', nextTick)
vi.stubGlobal('onMounted', onMounted)
vi.stubGlobal('onBeforeUnmount', onBeforeUnmount)

const AdminFormGroup = {
  name: 'AdminFormGroup',
  props: ['id', 'label', 'required', 'error', 'helpText', 'hint'],
  template: `<div class="form-group"><label v-if="label" :for="id">{{ label }}<span v-if="required" class="text-red-500">*</span></label><slot /></div>`,
}

const DateTimePicker = {
  name: 'DateTimePicker',
  components: { AdminFormGroup },
  props: {
    modelValue: { type: String, default: '' },
    mode: { type: String, default: 'date' },
    label: { type: String, default: undefined },
    id: { type: String, default: undefined },
    placeholder: { type: String, default: undefined },
    required: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    error: { type: String, default: undefined },
    helpText: { type: String, default: undefined },
  },
  emits: ['update:modelValue', 'blur'],
  setup(props: Record<string, unknown>, { emit }: { emit: (event: string, ...args: unknown[]) => void }) {
    const { parseValue, formatDisplay, toEmitValue } = useDateTimePicker()
    const mode = computed(() => (props.mode as string) || 'date')
    const isOpen = ref(false)

    const workingDate = ref<Date | null>(null)
    const workingHours = ref(0)
    const workingMinutes = ref(0)

    function syncFromModel() {
      const parsed = parseValue(props.modelValue as string, mode.value as 'date' | 'time' | 'datetime')
      workingDate.value = parsed.date
      workingHours.value = parsed.hours
      workingMinutes.value = parsed.minutes
    }

    syncFromModel()
    watch(() => props.modelValue, syncFromModel)

    const displayValue = computed(() =>
      formatDisplay(workingDate.value, workingHours.value, workingMinutes.value, mode.value as 'date' | 'time' | 'datetime'),
    )

    const effectivePlaceholder = computed(() => {
      if (props.placeholder) return props.placeholder
      switch (mode.value) {
        case 'time': return 'Select time'
        case 'datetime': return 'Select date and time'
        default: return 'Select date'
      }
    })

    function toggleOpen() {
      if (props.disabled) return
      isOpen.value = !isOpen.value
    }

    function emitValue() {
      const value = toEmitValue(workingDate.value, workingHours.value, workingMinutes.value, mode.value as 'date' | 'time' | 'datetime')
      emit('update:modelValue', value)
    }

    return { displayValue, effectivePlaceholder, isOpen, toggleOpen, emitValue, workingDate, workingHours, workingMinutes }
  },
  template: `
    <AdminFormGroup :id="id" :label="label" :required="required" :error="error" :help-text="helpText">
      <input
        :id="id"
        type="text"
        readonly
        :value="displayValue"
        :placeholder="effectivePlaceholder"
        :disabled="disabled"
        :class="['form-input', error ? 'border-red-500' : '', disabled ? 'opacity-50' : '']"
        @click="toggleOpen"
      />
    </AdminFormGroup>
  `,
}

describe('UiDateTimePicker', () => {
  describe('rendering', () => {
    it('renders with label and required indicator', () => {
      const wrapper = mount(DateTimePicker, {
        props: { label: 'Start Date', required: true, id: 'start' },
      })
      expect(wrapper.find('label').text()).toContain('Start Date')
      expect(wrapper.find('.text-red-500').exists()).toBe(true)
    })

    it('renders the input as readonly', () => {
      const wrapper = mount(DateTimePicker)
      const input = wrapper.find('input')
      expect(input.attributes('readonly')).toBeDefined()
    })

    it('shows error class when error prop is set', () => {
      const wrapper = mount(DateTimePicker, {
        props: { error: 'Required field' },
      })
      expect(wrapper.find('input').classes()).toContain('border-red-500')
    })

    it('is disabled when disabled prop is true', () => {
      const wrapper = mount(DateTimePicker, {
        props: { disabled: true },
      })
      expect(wrapper.find('input').attributes('disabled')).toBeDefined()
      expect(wrapper.find('input').classes()).toContain('opacity-50')
    })
  })

  describe('placeholders', () => {
    it('shows "Select date" for date mode', () => {
      const wrapper = mount(DateTimePicker, { props: { mode: 'date' } })
      expect(wrapper.find('input').attributes('placeholder')).toBe('Select date')
    })

    it('shows "Select time" for time mode', () => {
      const wrapper = mount(DateTimePicker, { props: { mode: 'time' } })
      expect(wrapper.find('input').attributes('placeholder')).toBe('Select time')
    })

    it('shows "Select date and time" for datetime mode', () => {
      const wrapper = mount(DateTimePicker, { props: { mode: 'datetime' } })
      expect(wrapper.find('input').attributes('placeholder')).toBe('Select date and time')
    })

    it('uses custom placeholder when provided', () => {
      const wrapper = mount(DateTimePicker, {
        props: { mode: 'date', placeholder: 'Pick a date' },
      })
      expect(wrapper.find('input').attributes('placeholder')).toBe('Pick a date')
    })
  })

  describe('display formatting', () => {
    it('displays formatted date for date mode', () => {
      const wrapper = mount(DateTimePicker, {
        props: { mode: 'date', modelValue: '2026-05-14' },
      })
      const value = wrapper.find('input').element.value
      expect(value).toContain('14')
      expect(value).toContain('May')
      expect(value).toContain('2026')
    })

    it('displays formatted time for time mode', () => {
      const wrapper = mount(DateTimePicker, {
        props: { mode: 'time', modelValue: '14:30' },
      })
      expect(wrapper.find('input').element.value).toBe('2:30 PM')
    })

    it('displays formatted datetime for datetime mode', () => {
      const wrapper = mount(DateTimePicker, {
        props: { mode: 'datetime', modelValue: '2026-05-14T10:30:00.000Z' },
      })
      const value = wrapper.find('input').element.value
      expect(value).toContain('14')
      expect(value).toContain('May')
      expect(value).toContain('10:30 AM')
    })

    it('shows empty when no value', () => {
      const wrapper = mount(DateTimePicker, {
        props: { mode: 'date', modelValue: '' },
      })
      expect(wrapper.find('input').element.value).toBe('')
    })
  })

  describe('interaction', () => {
    it('toggles open state on click when not disabled', async () => {
      const wrapper = mount(DateTimePicker)
      const input = wrapper.find('input')
      await input.trigger('click')
      expect(wrapper.vm.isOpen).toBe(true)
      await input.trigger('click')
      expect(wrapper.vm.isOpen).toBe(false)
    })

    it('does not toggle when disabled', async () => {
      const wrapper = mount(DateTimePicker, {
        props: { disabled: true },
      })
      await wrapper.find('input').trigger('click')
      expect(wrapper.vm.isOpen).toBe(false)
    })
  })

  describe('model sync', () => {
    it('updates display when modelValue changes', async () => {
      const wrapper = mount(DateTimePicker, {
        props: { mode: 'time', modelValue: '10:00' },
      })
      expect(wrapper.find('input').element.value).toBe('10:00 AM')
      await wrapper.setProps({ modelValue: '15:30' })
      expect(wrapper.find('input').element.value).toBe('3:30 PM')
    })
  })
})

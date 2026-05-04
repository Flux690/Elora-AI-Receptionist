import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const FIELDS: { key: string; label: string; placeholder: string; rows?: number }[] = [
  {
    key: 'hours',
    label: 'Business Hours',
    placeholder: 'e.g. Mon–Sat 9am–7pm, Sun 10am–5pm',
  },
  {
    key: 'address',
    label: 'Address',
    placeholder: 'e.g. 123 Main Street, Philadelphia, PA 19103',
  },
  {
    key: 'services',
    label: 'Services',
    placeholder: 'e.g. Haircut, Blowout, Color, Highlights, Balayage, Manicure, Pedicure',
    rows: 2,
  },
  {
    key: 'pricing',
    label: 'Pricing',
    placeholder: 'e.g. Haircut $45+, Color $85+, Balayage $120+, Manicure $25',
    rows: 2,
  },
  {
    key: 'booking',
    label: 'Booking Instructions',
    placeholder: 'e.g. Call or walk in. Appointments preferred on weekends.',
  },
  {
    key: 'cancellation',
    label: 'Cancellation Policy',
    placeholder: 'e.g. 24 hours notice required to avoid a $20 fee.',
  },
]

interface Props {
  value: Record<string, string>
  onChange: (v: Record<string, string>) => void
}

export default function BusinessDetailsForm({ value, onChange }: Props) {
  return (
    <div className="space-y-5">
      {FIELDS.map(({ key, label, placeholder, rows = 1 }) => (
        <div key={key} className="space-y-1.5">
          <Label htmlFor={key}>{label}</Label>
          <Textarea
            id={key}
            rows={rows}
            placeholder={placeholder}
            value={value[key] ?? ''}
            onChange={e => onChange({ ...value, [key]: e.target.value })}
          />
        </div>
      ))}
    </div>
  )
}

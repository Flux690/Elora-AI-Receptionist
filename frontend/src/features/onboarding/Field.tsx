interface FieldProps {
  label: string
  /** One line, always visible. A tooltip is a hover touch cannot reach. */
  help?: string
  htmlFor?: string
  required?: boolean
  children: React.ReactNode
}

export function Field({ label, help, htmlFor, required, children }: FieldProps) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="block font-medium text-foreground">
        {label}
        {required && (
          <span className="text-destructive" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      {help ? (
        <p className="mt-0.5 mb-2 text-muted-foreground">{help}</p>
      ) : (
        <div className="h-2" />
      )}
      {children}
    </div>
  )
}

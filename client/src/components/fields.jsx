// Campos de formulário reutilizáveis, com rótulo e mensagem de erro.
export function Field({ label, error, children, hint }) {
  return (
    <label className={`field ${error ? 'has-error' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

/** Campo de dinheiro: o usuário digita só números e o valor vai sendo formatado; o estado guarda centavos. */
export function MoneyInput({ value, onChange, ...rest }) {
  const text = value ? (value / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
  return (
    <div className="money-input">
      <span>R$</span>
      <input
        inputMode="numeric"
        placeholder="0,00"
        value={text}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
          onChange(digits ? Number(digits) : 0);
        }}
        {...rest}
      />
    </div>
  );
}

export function Segmented({ value, onChange, options }) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map(([val, label]) => (
        <button type="button" key={String(val)} role="radio" aria-checked={value === val}
          className={value === val ? 'on' : ''} onClick={() => onChange(val)}>{label}</button>
      ))}
    </div>
  );
}

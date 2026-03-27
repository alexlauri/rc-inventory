type Props = {
    children: React.ReactNode;
    className?: string;
  };
  
  export function H1({ children, className = "" }: Props) {
    return (
      <h1 className={`text-2xl font-semibold tracking-tight leading-tight [font-family:var(--font-cabinet)] ${className}`}>
        {children}
      </h1>
    );
  }
  
  export function H2({ children, className = "" }: Props) {
    return (
      <h2 className={`text-xl font-semibold tracking-tight leading-tight [font-family:var(--font-cabinet)] ${className}`}>
        {children}
      </h2>
    );
  }
  
  export function Label({ children, className = "" }: Props) {
    return (
      <div className={`font-medium [font-family:var(--font-cabinet)] ${className}`}>
        {children}
      </div>
    );
  }
  
  export function Subtle({ children, className = "" }: Props) {
    return (
      <div className={`text-sm text-gray-500 [font-family:var(--font-cabinet)] ${className}`}>
        {children}
      </div>
    );
  }
  
  export function Metric({ children, className = "" }: Props) {
    return (
      <div className={`text-5xl font-semibold leading-none [font-family:var(--font-cabinet)] ${className}`}>
        {children}
      </div>
    );
  }
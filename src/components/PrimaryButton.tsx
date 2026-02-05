import type { ButtonHTMLAttributes } from "react";

export default function PrimaryButton({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`primary-button${className ? ` ${className}` : ""}`}
    />
  );
}

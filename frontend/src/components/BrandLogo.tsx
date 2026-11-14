interface BrandLogoProps {
  dark?: boolean;
  className?: string;
  src?: string;
}
export default function BrandLogo({
  dark = false,
  className = "",
  src,
}: BrandLogoProps) {
  return (
    <span className={`brand-logo ${className}`}>
      <img
        src={src || `/logo/tech-solution-agency${dark ? "-dark" : ""}.svg`}
        width={680}
        height={200}
        alt="Tech Solutions"
        decoding="async"
      />
    </span>
  );
}

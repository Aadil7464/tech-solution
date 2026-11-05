interface BrandLogoProps {
  dark?: boolean;
  responsive?: boolean;
  className?: string;
  src?: string;
}
export default function BrandLogo({
  dark = false,
  responsive = false,
  className = "",
  src,
}: BrandLogoProps) {
  const image = (
    <img
      src={src || `/logo/digital-mitra-agency${dark ? "-dark" : ""}.svg`}
      width={680}
      height={200}
      alt="Digital Mitra Agency — Your Partner in Digital Growth"
      decoding="async"
    />
  );
  return (
    <span className={`brand-logo ${className}`}>
      {responsive && !src ? (
        <picture>
          <source
            media="(max-width:800px)"
            srcSet="/logo/digital-mitra-monogram.svg"
            width={200}
            height={200}
          />
          {image}
        </picture>
      ) : (
        image
      )}
    </span>
  );
}

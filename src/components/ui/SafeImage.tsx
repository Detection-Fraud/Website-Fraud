"use client";
import Image, { ImageProps } from "next/image";
import { useState } from "react";
import { FiImage } from "react-icons/fi";

interface SafeImageProps extends Omit<ImageProps, "onError"> {
  fallbackSrc?: string;
  fallbackIconClassName?: string;
}

export default function SafeImage({
  src,
  alt,
  fallbackSrc,
  fallbackIconClassName,
  className,
  ...props
}: SafeImageProps) {
  const [error, setError] = useState(false);
  const [imgSrc, setImgSrc] = useState(src);

  if (error || !src) {
    if (fallbackSrc) {
      return (
        <Image {...props} src={fallbackSrc} alt={alt} className={className} />
      );
    }
    return (
      <div
        className={`flex items-center justify-center bg-slate-100 dark:bg-zinc-800 ${className}`}
      >
        <FiImage className={fallbackIconClassName} />
      </div>
    );
  }

  return (
    <Image
      {...props}
      src={imgSrc}
      alt={alt}
      className={className}
      onError={() => {
        if (fallbackSrc && imgSrc !== fallbackSrc) {
          setImgSrc(fallbackSrc);
        } else {
          setError(true);
        }
      }}
    />
  );
}

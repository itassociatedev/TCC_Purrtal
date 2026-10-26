import { useEffect, useMemo, useState } from 'react';
import GHImage from '@/Assets/GH.webp';
import ALBImage from '@/Assets/ALB.webp';
import GHPortraitImage from '@/Assets/GH Portrait.webp';
import ALBPortraitImage from '@/Assets/ALB Portrait.webp';
import MKTPortraitImage from '@/Assets/MKT Portrait 1.webp';
import MKTImage from '@/Assets/MKT.webp';

export default function BackgroundCarousel() {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isMobile, setIsMobile] = useState(false);

    const desktopSlides = useMemo(() => ([
        { src: GHImage, position: 'center center' },
        { src: ALBImage, position: 'center center' },
        { src: MKTImage, position: 'center center' },
    ]), []);

    const mobileSlides = useMemo(() => ([
        { src: MKTPortraitImage, position: 'center center' },
        { src: ALBPortraitImage, position: 'center center' },
        { src: GHPortraitImage, position: 'center center' },
    ]), []);

    const slides = isMobile ? mobileSlides : desktopSlides;

    useEffect(() => {
        const mediaQuery = window.matchMedia('(max-width: 639px)');
        const updateViewport = (event) => {
            setIsMobile(event.matches);
        };

        setIsMobile(mediaQuery.matches);
        mediaQuery.addEventListener('change', updateViewport);

        return () => mediaQuery.removeEventListener('change', updateViewport);
    }, []);

    useEffect(() => {
        setCurrentSlide(0);
    }, [isMobile]);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % slides.length);
        }, 5000);

        return () => clearInterval(interval);
    }, [slides.length]);

    return (
        <>
            {slides.map((slide, index) => (
                <div
                    key={index}
                    className={`absolute inset-0 transition-opacity duration-1000 ${
                        index === currentSlide ? 'opacity-100' : 'opacity-0'
                    }`}
                >
                    <img
                        src={slide.src}
                        alt={`Slide ${index + 1}`}
                        className="w-full h-full object-cover"
                        style={{ objectPosition: slide.position }}
                    />
                </div>
            ))}
        </>
    );
}

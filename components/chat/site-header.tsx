import Image from "next/image";
import Link from "next/link";
import { Orbitron } from "next/font/google";

const orbitron = Orbitron({ subsets: ["latin"] });


export function Header() {
    return (
        <>
            <header className="pt-4 fixed left-0 top-0 z-50 w-full translate-y-[-1rem] animate-fade-in border-b border-base-200 backdrop-blur-[12px] [--animation-delay:600ms]">
                <div className="container flex h-[3.5rem] items-center justify-center">
                    <Link
                        className="flex items-center text-md text-black"
                        href="https://ppq.ai"
                        target="_blank"
                    >
                        <div className="flex items-center">
                            <Image
                                src='https://deepresearch.ppq.ai/flame2.png'
                                alt="Anotherwrapper Logo"
                                width={40}
                                height={40}
                                className="w-10 h-auto"
                                unoptimized
                            />
                            <h1
                              className={`${orbitron.className} text-gray-900 dark:text-white text-2xl font-extrabold`}
                            >
                              PayPerQ
                            </h1>
                        </div>
                    </Link>
                </div>
            </header>
        </>
    );
}

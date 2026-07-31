"use client";

export default function Home() {
  const handleClick = () => {
    if (typeof window !== "undefined" && window.electronAPI?.sayHello) {
      window.electronAPI.sayHello();
    } else {
      console.warn("electronAPI not available (are you in browser?)");
    }
  };

  return (
    <main className="min-h-screen flex flex-col justify-center items-center">
      <h1>Hello from Electron + Next.js!</h1>
      <button onClick={handleClick} className="bg-rose-500 px-2 py-1 rounded-full text-rose-100 text-xs hover:bg-rose-600 hover:scale-105 active:bg-rose-300 transition-all ease-in-out duration-300">Get a hello from console</button>
    </main>
  );
}

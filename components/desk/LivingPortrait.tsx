"use client";

export function LivingPortrait() {
  return (
    <div className="living-portrait z-[1]" aria-hidden="true">
      <div
        className="living-portrait__frame md:hidden"
        style={{
          backgroundImage: "url(/desk/receptionist-portrait.png)",
          backgroundSize: "cover",
          backgroundPosition: "50% 38%",
        }}
      />
      <div
        className="living-portrait__frame hidden md:block"
        style={{
          backgroundImage: "url(/desk/receptionist-idle.png)",
          backgroundSize: "cover",
          backgroundPosition: "58% 42%",
        }}
      />
      <div className="living-portrait__light" />
    </div>
  );
}

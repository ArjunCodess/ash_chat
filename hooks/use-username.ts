import { useEffect, useState } from "react";

const STORAGE_KEY = "ashchat_username";

const generateUsername = () => {
  const adjectives = ["Swift", "Silent", "Brave", "Clever", "Mighty"];
  const nouns = ["Tiger", "Eagle", "Shark", "Panther", "Wolf"];

  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];

  return `${adjective}${noun}`;
};

export const useUsername = () => {
  const [username, setUsername] = useState("");

  useEffect(() => {
    const main = () => {
      let storedUsername = localStorage.getItem(STORAGE_KEY);
      if (!storedUsername) {
        storedUsername = generateUsername();
        localStorage.setItem(STORAGE_KEY, storedUsername);
      }
      setUsername(storedUsername);
    };

    main();
  }, []);

  return { username };
};

import React, { useState, useEffect, useRef, useCallback } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { FaMicrophone, FaMicrophoneAltSlash } from "react-icons/fa";
import { SiGoogleassistant } from "react-icons/si";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";

const ChatBot = () => {
  const [history, setHistory] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [speechError, setSpeechError] = useState(null);
  const [showPopover, setShowPopover] = useState(false);

  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);
  const utteranceRef = useRef(null);
  const chatContainerRef = useRef(null);

  const [genAI, setGenAI] = useState(null);
  const [model, setModel] = useState(null);

  const generationConfig = {
    temperature: 0.7,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 4096,
    responseMimeType: "text/plain",
  };

  useEffect(() => {
    const initializeGenAI = async () => {
      try {
        const genAIInstance = new GoogleGenerativeAI(
          import.meta.env.VITE_API_KEY
        );
        const modelInstance = await genAIInstance.getGenerativeModel({
          model: "gemini-1.5-flash-latest",
          generationConfig,
          systemInstruction:
            "You are a voice assistant created by Iefan. Provide helpful, concise answers in 5 lines or less. Use plain text without emoji or markdown. Always respond in English.",
        });

        setGenAI(genAIInstance);
        setModel(modelInstance);
      } catch (error) {
        console.error("Failed to initialize GenAI:", error);
        setSpeechError("Failed to initialize AI model. Please try again later.");
      }
    };

    initializeGenAI();
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [history]);

  useEffect(() => {
    if (!genAI || !model) return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setShowPopover(true);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognitionRef.current = recognition;

    recognition.onresult = handleResult;
    recognition.onerror = handleError;
    recognition.onend = () => setIsProcessing(false);

    return () => {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
    };
  }, [genAI, model]);

  const handleResult = useCallback(async (event) => {
    const transcript = event.results[0][0].transcript.trim();

    setHistory((prevHistory) => [
      ...prevHistory,
      { role: "user", parts: transcript },
    ]);
    setIsProcessing(true);

    try {
      const chat = await model.startChat();
      const result = await chat.sendMessageStream(transcript);
      const response = await result.response;
      const text = await response.text();

      setHistory((prevHistory) => [
        ...prevHistory,
        { role: "model", parts: text },
      ]);
      speakResponse(markdownToPlainText(text));
    } catch (error) {
      console.error("Error processing speech:", error);
      setSpeechError("Failed to process your request. Please try again.");
      setIsProcessing(false);
    }
  }, [model]);

  const handleError = useCallback((event) => {
    console.error("Speech recognition error:", event.error);
    setSpeechError(`Speech recognition error: ${event.error}`);
    setIsProcessing(false);
  }, []);

  const speakResponse = useCallback((text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.2;
    utterance.pitch = 1.0;

    const voices = synthRef.current.getVoices();
    utterance.voice =
      voices.find((voice) => voice.name === "Google US English") ||
      voices.find((voice) => voice.lang === "en-US") ||
      voices[0];

    utterance.onend = () => {
      setIsProcessing(false);
    };

    utteranceRef.current = utterance;
    synthRef.current.speak(utterance);
  }, []);

  const markdownToPlainText = (markdown) => {
    const div = document.createElement("div");
    div.innerHTML = markdown;
    return div.textContent || div.innerText || "";
  };

  const toggleSpeechRecognition = useCallback(() => {
    if (!recognitionRef.current) return;

    synthRef.current.cancel();
    if (isProcessing) {
      recognitionRef.current.stop();
      setIsProcessing(false);
    } else {
      recognitionRef.current.start();
      setIsProcessing(true);
      setSpeechError(null);
    }
  }, [isProcessing]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
      <div
        className="flex flex-col w-full h-[70vh] overflow-y-auto mb-4 p-2 rounded bg-gray-800"
        ref={chatContainerRef}
      >
        <AnimatePresence>
          {history.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className={`${
                item.role === "user" ? "text-right mb-2" : "text-left mb-2"
              }`}
            >
              {item.role === "user" ? (
                <span className="inline-block bg-blue-600 rounded-lg px-4 py-2 text-white">
                  {item.parts}
                </span>
              ) : (
                <ReactMarkdown className="inline-block bg-gray-700 rounded-lg px-4 py-2 text-gray-200">
                  {item.parts}
                </ReactMarkdown>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <div className="relative flex items-center justify-center w-full h-20">
        <motion.button
          onMouseDown={toggleSpeechRecognition}
          className={`flex items-center justify-center w-20 h-20 rounded-full shadow-lg transition ${
            isProcessing ? "bg-red-600" : "bg-blue-600"
          }`}
          whileTap={{ scale: 0.9 }}
          whileHover={{ scale: 1.1 }}
        >
          {isProcessing ? (
            <FaMicrophoneAltSlash className="text-3xl text-white" />
          ) : (
            <SiGoogleassistant className="text-3xl text-white" />
          )}
        </motion.button>
        {isProcessing && (
          <motion.div
            className="absolute w-24 h-24 rounded-full border-4 border-blue-300"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          ></motion.div>
        )}
      </div>
      <AnimatePresence>
        {speechError && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mt-4 p-2 bg-red-600 text-white rounded"
          >
            {speechError}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showPopover && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-0 left-0 right-0 p-4 bg-red-600 text-white text-center"
          >
            Web Speech API is not supported in this browser. Please use Chrome or Safari.
            <a
              href="https://ai.iefan.tech"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-300 font-bold underline ml-1"
            >
              Learn more
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ChatBot;

import { useState, useEffect } from "react";

const V11_STAGES = [
  { text: "Analyzing vehicle geometry...", duration: 2000 },
  { text: "Removing outdoor reflections...", duration: 4000 },
  { text: "Virtual washing & color locking...", duration: 4500 },
  { text: "Rendering studio lighting...", duration: 5000 },
  { text: "Applying floor specular highlights...", duration: 4000 },
  { text: "Finalizing photorealism...", duration: 10000 },
];

const DEFAULT_STAGES = [
  { text: "Initializing AI pipeline...", duration: 3000 },
  { text: "Generating new environment...", duration: 6000 },
  { text: "Applying final polish...", duration: 10000 },
];

export function useProcessingStages(
  isProcessing: boolean,
  pipelineVersion: string
): string {
  const [currentStageText, setCurrentStageText] = useState("");

  useEffect(() => {
    if (!isProcessing) {
      setCurrentStageText("");
      return;
    }

    const stages = pipelineVersion === "11" ? V11_STAGES : DEFAULT_STAGES;
    let currentStageIndex = 0;
    setCurrentStageText(stages[0].text);

    let timeoutId: ReturnType<typeof setTimeout>;

    const advanceStage = () => {
      currentStageIndex++;
      if (currentStageIndex < stages.length) {
        setCurrentStageText(stages[currentStageIndex].text);
        timeoutId = setTimeout(
          advanceStage,
          stages[currentStageIndex].duration
        );
      }
    };

    timeoutId = setTimeout(advanceStage, stages[0].duration);
    return () => clearTimeout(timeoutId);
  }, [isProcessing, pipelineVersion]);

  return currentStageText;
}

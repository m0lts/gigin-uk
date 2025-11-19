import { useEffect, useMemo, useRef, useState } from "react";
import { GuitarsIcon, RightArrowIcon, LeftChevronIcon, NoImageIcon, LightModeIcon, LeftArrowIcon } from "../../../shared/ui/extras/Icons";
import { LoadingSpinner } from "../../../shared/ui/loading/Loading";

export const CREATION_STEP_ORDER = ["hero-image", "stage-name", "profile-details", "media", "ready"];

const STEP_COMPONENTS = {
  "hero-image": HeroImageStep,
  "stage-name": StageNameStep,
  "profile-details": ProfileDetailsStep,
  media: MediaStep,
  ready: ReviewStep,
};

const DEFAULT_STEP = CREATION_STEP_ORDER[0];

export const ProfileCreationBox = ({
  onStartJourney,
  isLoading = false,
  isCreating = false,
  creationStep = DEFAULT_STEP,
  onCreationStepChange,
  onCompleteCreation,
  onHeroImageUpdate,
  initialHeroImage = null,
  heroBrightness = 100,
  onHeroBrightnessChange,
  initialArtistName = "",
  onArtistNameChange,
}) => {
  const [artistName, setArtistName] = useState(initialArtistName);
  const [heroImage, setHeroImage] = useState(null);
  const [heroFlowStage, setHeroFlowStage] = useState("upload");
  const [displayedStep, setDisplayedStep] = useState(() =>
    CREATION_STEP_ORDER.includes(creationStep) ? creationStep : DEFAULT_STEP
  );
  const [previousStep, setPreviousStep] = useState(null);
  const [transitionDirection, setTransitionDirection] = useState("forward");
  const transitionTimeoutRef = useRef(null);
  const heroFileInputRef = useRef(null);
  const containerRef = useRef(null);
  const contentWrapperRef = useRef(null);
  const [containerHeight, setContainerHeight] = useState("auto");

  const normalizedStep = useMemo(
    () => (CREATION_STEP_ORDER.includes(creationStep) ? creationStep : DEFAULT_STEP),
    [creationStep]
  );

  const resolveStepIndex = (step) => {
    const idx = CREATION_STEP_ORDER.indexOf(step);
    return idx === -1 ? 0 : idx;
  };

  const currentStepIndex = resolveStepIndex(displayedStep);
  const totalSteps = CREATION_STEP_ORDER.length;
  const isFinalStep = currentStepIndex === totalSteps - 1;

  useEffect(() => {
    if (initialArtistName !== artistName && initialArtistName) {
      setArtistName(initialArtistName);
    }
  }, [initialArtistName]);

  useEffect(() => {
    if (!initialHeroImage) return;
    if (
      !heroImage ||
      heroImage.previewUrl !== initialHeroImage.previewUrl ||
      heroImage.storagePath !== initialHeroImage.storagePath
    ) {
      setHeroImage(initialHeroImage);
      setHeroFlowStage(initialHeroImage.mode || "adjust");
    }
  }, [initialHeroImage, heroImage]);

  useEffect(() => {
    if (isCreating) return;
    if (heroImage?.file && heroImage.previewUrl) {
      URL.revokeObjectURL(heroImage.previewUrl);
    }
    if (initialHeroImage) {
      setHeroImage(initialHeroImage);
      setHeroFlowStage(initialHeroImage.mode || "adjust");
    } else {
      setHeroImage(null);
      setHeroFlowStage("upload");
    }
  }, [isCreating, initialHeroImage]);

  useEffect(() => {
    if (!isCreating) {
      if (heroImage?.previewUrl) {
        URL.revokeObjectURL(heroImage.previewUrl);
      }
      setHeroImage(null);
      setHeroFlowStage("upload");
      onHeroBrightnessChange?.(100);
      setArtistName("");
      setPreviousStep(null);
      setDisplayedStep(DEFAULT_STEP);
      return;
    }

    if (normalizedStep === displayedStep) return;

    const direction =
      resolveStepIndex(normalizedStep) >= resolveStepIndex(displayedStep)
        ? "forward"
        : "backward";

    setTransitionDirection(direction);
    setPreviousStep(displayedStep);
    setDisplayedStep(normalizedStep);

    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }
    transitionTimeoutRef.current = setTimeout(() => {
      setPreviousStep(null);
    }, 350);
  }, [isCreating, normalizedStep, displayedStep, heroImage]);

  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }

      if (heroImage?.previewUrl) {
        URL.revokeObjectURL(heroImage.previewUrl);
      }
    };
  }, [heroImage]);

  // Measure and update container height for smooth transitions
  useEffect(() => {
    if (!contentWrapperRef.current) return;

    const wrapper = contentWrapperRef.current;
    let rafId = null;

    const updateHeight = () => {
      if (!wrapper || !containerRef.current) return;
      
      // Measure the wrapper's natural height
      const naturalHeight = wrapper.scrollHeight;
      
      // Set the height on the container (this will trigger the CSS transition)
      setContainerHeight(`${naturalHeight}px`);
    };

    // Use ResizeObserver for automatic height detection
    const resizeObserver = new ResizeObserver((entries) => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateHeight);
    });

    resizeObserver.observe(wrapper);

    // Initial measurement with a small delay to ensure DOM is ready
    const initialTimeout = setTimeout(() => {
      updateHeight();
    }, 50);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      clearTimeout(initialTimeout);
      resizeObserver.disconnect();
    };
  }, [displayedStep, heroFlowStage, isCreating, artistName, heroImage, previousStep]);

  const goToStep = (stepId) => {
    if (!CREATION_STEP_ORDER.includes(stepId)) return;
    onCreationStepChange?.(stepId);
  };

  const heroStepReady = !!heroImage && heroFlowStage === "adjust";

  const handleAdvance = () => {
    if (!isCreating) {
      onStartJourney?.();
      return;
    }

    if (displayedStep === "hero-image" && !heroStepReady) {
      return;
    }

    if (isFinalStep) {
      onCompleteCreation?.();
      return;
    }

    const nextStep = CREATION_STEP_ORDER[currentStepIndex + 1];
    goToStep(nextStep);
  };

  const handleBack = () => {
    if (displayedStep === "hero-image" && heroFlowStage === "adjust") {
      setHeroFlowStage("upload");
      return;
    }
    if (!isCreating || currentStepIndex === 0) return;
    const previous = CREATION_STEP_ORDER[currentStepIndex - 1];
    goToStep(previous);
  };

  const handleHeroImagePicked = (file) => {
    if (!file) return;
    if (heroImage?.previewUrl) {
      URL.revokeObjectURL(heroImage.previewUrl);
    }
    const previewUrl = URL.createObjectURL(file);
    setHeroImage({ file, previewUrl });
    setHeroFlowStage("adjust");
    onHeroBrightnessChange?.(100);
    onHeroImageUpdate?.({ previewUrl, file });
  };

  const handleHeroFileInputChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    handleHeroImagePicked(file);
  };

  const handleArtistNameChange = (newName) => {
    setArtistName(newName);
    onArtistNameChange?.(newName);
  };

  const renderStepPanel = (stepKey) => {
    const Component = STEP_COMPONENTS[stepKey] || PlaceholderStep;
    return (
      <Component
        artistName={artistName}
        onArtistNameChange={handleArtistNameChange}
        heroImage={heroImage}
        heroMode={heroFlowStage}
        heroBrightness={heroBrightness}
        onHeroImageSelect={() => heroFileInputRef.current?.click()}
        onHeroBrightnessChange={onHeroBrightnessChange}
      />
    );
  };

  const creationPanelsClass = [
    "creation-step-panels",
    previousStep ? "is-transitioning" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const renderProgressDots = () => (
    <div className="creation-progress-dots">
      {CREATION_STEP_ORDER.map((stepId, index) => {
        const completed = index < currentStepIndex;
        const active = index === currentStepIndex;
        return (
          <span
            key={stepId}
            className={`progress-dot ${completed ? "filled" : ""} ${active ? "active" : ""}`}
          />
        );
      })}
    </div>
  );

  const actionsClassName = [
    "creation-box-actions",
    isCreating ? "" : "single",
    isCreating && displayedStep === "hero-image" && !heroStepReady ? "hidden" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div 
      className="artist-profile-creation-box"
      ref={containerRef}
      style={{ height: containerHeight }}
    >
      <div ref={contentWrapperRef}>
        <div className="creation-box-header">
          <div className="creation-box-title">
            <GuitarsIcon />
            <h3>Your Artist Profile</h3>
          </div>
          {isCreating && renderProgressDots()}
        </div>
        <div className="creation-box-content">
        {!isCreating ? (
          <p>
            This is what your profile could look like. Create your own artist profile and start connecting with venues, booking gigs, and building your music career today!
          </p>
        ) : (
          <div className={creationPanelsClass}>
            {previousStep && (
              <div className={`creation-step-panel exit ${transitionDirection}`}>
                {renderStepPanel(previousStep)}
              </div>
            )}
            <div
              key={displayedStep}
              className={`creation-step-panel enter ${transitionDirection} ${
                previousStep ? "animating" : ""
              }`}
            >
              {renderStepPanel(displayedStep)}
            </div>
          </div>
        )}
      </div>

      <input
        type="file"
        accept="image/*"
        ref={heroFileInputRef}
        style={{ display: "none" }}
        onChange={handleHeroFileInputChange}
      />

      <div className={actionsClassName}>
        {isCreating ? (
          <>
            <button
              className="btn tertiary creation-back-btn"
              type="button"
              onClick={handleBack}
              disabled={currentStepIndex === 0}
            >
              <LeftArrowIcon />
              Back
            </button>
            <button
              className="btn artist-profile"
              type="button"
              onClick={handleAdvance}
              disabled={isLoading}
            >
              {isLoading ? (
                <LoadingSpinner width={15} height={15} marginTop={0} marginBottom={0} color="white" />
              ) : (
                <>
                  {isFinalStep ? "Finish Profile" : "Next"} <RightArrowIcon />
                </>
              )}
            </button>
          </>
        ) : (
          <button className="btn artist-profile" onClick={handleAdvance} disabled={isLoading}>
            {!isLoading ? (
              <>
                Create Your Artist Profile <RightArrowIcon />
              </>
            ) : (
              <LoadingSpinner width={15} height={15} marginTop={0} marginBottom={0} color="white" />
            )}
          </button>
        )}
      </div>
      </div>
    </div>
  );
};

function HeroImageStep({
  heroImage,
  heroMode,
  heroBrightness,
  onHeroImageSelect,
  onHeroBrightnessChange,
}) {
  if (!heroImage || heroMode === "upload") {
    return (
      <>
        <p className="creation-step-question">Upload your hero image. The best image you can find of you!</p>
        <button type="button" className="creation-hero-upload" onClick={onHeroImageSelect}>
          <NoImageIcon className="upload-icon" />
          <span>Choose Image</span>
        </button>
      </>
    );
  }

  return (
    <>
      <p className="creation-step-question">
        How does it look? Adjust the brightness of the image to your liking.
      </p>
      <div className="creation-hero-adjust">
        <button type="button" className="creation-hero-upload change-upload" onClick={onHeroImageSelect}>
          <NoImageIcon className="upload-icon" />
          <span>Try Another Image</span>
        </button>
        <div className="hero-brightness-control">
          <div className="brightness-header">
            <LightModeIcon />
            <span>Brightness</span>
          </div>
          <input
            className="hero-brightness-slider"
            type="range"
            min={60}
            max={140}
            value={heroBrightness}
            onChange={(e) => onHeroBrightnessChange?.(Number(e.target.value))}
          />
        </div>
      </div>
    </>
  );
}

function StageNameStep({ artistName, onArtistNameChange }) {
  return (
    <>
      <p className="creation-step-question">What's your stage name?</p>
      <div className="creation-stage-name-wrapper">
        <input
          id="artist-name-input"
          type="text"
          value={artistName}
          onChange={(e) => onArtistNameChange(e.target.value)}
          placeholder="Stage Name"
          className="creation-stage-name-input"
        />
      </div>
    </>
  );
}

function ProfileDetailsStep() {
  return (
    <>
      <p className="creation-step-question">Add a quick intro so venues know your vibe.</p>
      <div className="creation-placeholder-card">
        Bio, location and hero imagery inputs are coming in the next update.
      </div>
    </>
  );
}

function MediaStep() {
  return (
    <>
      <p className="creation-step-question">Upload or link two standout videos.</p>
      <ul className="creation-tip-list">
        <li>Short clips (under 60s) keep venues engaged.</li>
        <li>Use Vimeo, YouTube or direct MP4 links.</li>
        <li>You can reorder media later.</li>
      </ul>
    </>
  );
}

function ReviewStep({ artistName }) {
  return (
    <>
      <p className="creation-step-question">Nice! Give everything a quick review before publishing.</p>
      <div className="creation-summary">
        <p><strong>Artist name:</strong> {artistName || "Not set yet"}</p>
        <p><strong>Media:</strong> Add videos & tracks next.</p>
      </div>
    </>
  );
}

function PlaceholderStep() {
  return (
    <div className="creation-placeholder-card">
      This step is on its way. Sit tight!
    </div>
  );
}

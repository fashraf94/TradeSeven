import React, { useState } from 'react';
import RiskStyleScreen from './RiskStyleScreen';
import SectorSelectionScreen from './SectorSelectionScreen';
import MustHavePicksScreen from './MustHavePicksScreen';
import GamePlanResultScreen from './GamePlanResultScreen';

const STEPS = {
  RISK_STYLE: 'risk_style',
  SECTOR_SELECTION: 'sector_selection',
  MUST_HAVE_PICKS: 'must_have_picks',
  GAME_PLAN_RESULT: 'game_plan_result'
};

const BaggerBombGamePlanFlow = ({ onComplete, onBack }) => {
  const [currentStep, setCurrentStep] = useState(STEPS.RISK_STYLE);
  const [gamePlanData, setGamePlanData] = useState({
    riskStyle: null,
    selectedSectors: [],
    mustHavePicks: [],
    recommendations: null
  });

  const handleRiskStyleSelect = (riskStyle) => {
    setGamePlanData(prev => ({ ...prev, riskStyle }));
    setCurrentStep(STEPS.SECTOR_SELECTION);
  };

  const handleSectorsSelect = (selectedSectors) => {
    setGamePlanData(prev => ({ ...prev, selectedSectors }));
    setCurrentStep(STEPS.MUST_HAVE_PICKS);
  };

  const handleMustHavePicks = (mustHavePicks) => {
    setGamePlanData(prev => ({ ...prev, mustHavePicks }));
    setCurrentStep(STEPS.GAME_PLAN_RESULT);
  };

  const handleBack = () => {
    switch (currentStep) {
      case STEPS.SECTOR_SELECTION:
        setCurrentStep(STEPS.RISK_STYLE);
        break;
      case STEPS.MUST_HAVE_PICKS:
        setCurrentStep(STEPS.SECTOR_SELECTION);
        break;
      case STEPS.GAME_PLAN_RESULT:
        setCurrentStep(STEPS.MUST_HAVE_PICKS);
        break;
      default:
        onBack?.();
    }
  };

  const handleComplete = (portfolio) => {
    onComplete?.(portfolio);
  };

  switch (currentStep) {
    case STEPS.RISK_STYLE:
      return (
        <RiskStyleScreen
          onBack={onBack}
          onNext={handleRiskStyleSelect}
          selectedStyle={gamePlanData.riskStyle}
        />
      );

    case STEPS.SECTOR_SELECTION:
      return (
        <SectorSelectionScreen
          onBack={handleBack}
          onNext={handleSectorsSelect}
          riskStyle={gamePlanData.riskStyle}
        />
      );

    case STEPS.MUST_HAVE_PICKS:
      return (
        <MustHavePicksScreen
          onBack={handleBack}
          onNext={handleMustHavePicks}
          selectedSectors={gamePlanData.selectedSectors}
          riskStyle={gamePlanData.riskStyle}
        />
      );

    case STEPS.GAME_PLAN_RESULT:
      return (
        <GamePlanResultScreen
          onBack={handleBack}
          onComplete={handleComplete}
          gamePlanData={gamePlanData}
        />
      );

    default:
      return null;
  }
};

export default BaggerBombGamePlanFlow;

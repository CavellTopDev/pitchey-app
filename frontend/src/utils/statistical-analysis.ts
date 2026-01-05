// Statistical Analysis Tools and Calculators for A/B Testing
// Note: Using custom statistical functions to avoid external dependencies

// Types
export interface SampleSizeCalculatorInput {
  baselineConversionRate: number; // 0-1
  minimumDetectableEffect: number; // 0-1
  significanceLevel: number; // typically 0.05
  statisticalPower: number; // typically 0.8
  twoSided: boolean; // true for two-sided test
}

export interface SampleSizeResult {
  sampleSizePerVariant: number;
  totalSampleSize: number;
  expectedDuration?: number; // in days, if traffic provided
}

export interface StatisticalTestInput {
  controlConversions: number;
  controlSampleSize: number;
  variantConversions: number;
  variantSampleSize: number;
  significanceLevel?: number;
}

export interface StatisticalTestResult {
  pValue: number;
  zScore: number;
  isStatisticallySignificant: boolean;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  lift: number; // percentage lift
  liftConfidenceInterval: {
    lower: number;
    upper: number;
  };
  relativeRisk: number;
  oddsRatio: number;
}

export interface BayesianTestInput {
  controlConversions: number;
  controlSampleSize: number;
  variantConversions: number;
  variantSampleSize: number;
  priorAlpha?: number;
  priorBeta?: number;
}

export interface BayesianTestResult {
  probabilityToBeatControl: number;
  expectedLift: number;
  credibleInterval: {
    lower: number;
    upper: number;
  };
  posteriorControl: {
    alpha: number;
    beta: number;
  };
  posteriorVariant: {
    alpha: number;
    beta: number;
  };
}

export interface PowerAnalysisInput {
  controlConversionRate: number;
  variantConversionRate: number;
  sampleSizePerVariant: number;
  significanceLevel?: number;
}

export interface PowerAnalysisResult {
  statisticalPower: number;
  minimumDetectableEffect: number;
  isAdequatelyPowered: boolean; // > 0.8
}

// Custom statistical functions
class StatUtils {
  // Normal distribution inverse (quantile function)
  static normalInv(p: number, mean: number = 0, std: number = 1): number {
    // Beasley-Springer-Moro algorithm approximation
    const a = [0, -3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [0, -5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    const c = [0, -7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [0, 7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];

    const pLow = 0.02425;
    const pHigh = 1 - pLow;
    let q: number, r: number;

    if (p < 0 || p > 1) throw new Error("p must be between 0 and 1");
    if (p === 0) return -Infinity;
    if (p === 1) return Infinity;

    if (p < pLow) {
      q = Math.sqrt(-2 * Math.log(p));
      r = (((((c[1] * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) * q + c[6]) / ((((d[1] * q + d[2]) * q + d[3]) * q + d[4]) * q + 1);
    } else if (p <= pHigh) {
      q = p - 0.5;
      r = q * q;
      r = (((((a[1] * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * r + a[6]) * q / (((((b[1] * r + b[2]) * r + b[3]) * r + b[4]) * r + b[5]) * r + 1);
    } else {
      q = Math.sqrt(-2 * Math.log(1 - p));
      r = -(((((c[1] * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) * q + c[6]) / ((((d[1] * q + d[2]) * q + d[3]) * q + d[4]) * q + 1);
    }

    return mean + std * r;
  }

  // Normal distribution CDF
  static normalCdf(x: number, mean: number = 0, std: number = 1): number {
    return 0.5 * (1 + this.erf((x - mean) / (std * Math.sqrt(2))));
  }

  // Error function approximation
  static erf(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }

  // Chi-square CDF approximation
  static chiSquareCdf(x: number, df: number): number {
    if (x <= 0) return 0;
    if (df === 1) return 2 * this.normalCdf(Math.sqrt(x)) - 1;
    if (df === 2) return 1 - Math.exp(-x / 2);
    
    // Approximation for higher degrees of freedom
    return this.normalCdf((Math.pow(x / df, 1/3) - 1 + 2/(9*df)) / Math.sqrt(2/(9*df)));
  }

  // Beta distribution sample (using rejection sampling)
  static betaSample(alpha: number, beta: number): number {
    // Use rejection sampling for simplicity
    const gamma1 = this.gammaSample(alpha);
    const gamma2 = this.gammaSample(beta);
    return gamma1 / (gamma1 + gamma2);
  }

  // Gamma distribution sample (using Marsaglia and Tsang method)
  static gammaSample(shape: number): number {
    if (shape < 1) {
      return this.gammaSample(shape + 1) * Math.pow(Math.random(), 1/shape);
    }

    const d = shape - 1/3;
    const c = 1 / Math.sqrt(9 * d);

    while (true) {
      let x, v;
      do {
        x = this.normalSample();
        v = 1 + c * x;
      } while (v <= 0);

      v = v * v * v;
      const u = Math.random();

      if (u < 1 - 0.331 * x * x * x * x) {
        return d * v;
      }

      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
        return d * v;
      }
    }
  }

  // Standard normal sample using Box-Muller transform
  static normalSample(): number {
    if (StatUtils.spare !== undefined) {
      const temp = StatUtils.spare;
      StatUtils.spare = undefined;
      return temp;
    }

    const u1 = Math.random();
    const u2 = Math.random();
    const mag = Math.sqrt(-2 * Math.log(u1));
    const z0 = mag * Math.cos(2 * Math.PI * u2);
    const z1 = mag * Math.sin(2 * Math.PI * u2);
    
    StatUtils.spare = z1;
    return z0;
  }

  private static spare: number | undefined;
}

// Statistical Analysis Class
export class StatisticalAnalysis {
  
  // Sample Size Calculator
  static calculateSampleSize(input: SampleSizeCalculatorInput): SampleSizeResult {
    const {
      baselineConversionRate: p1,
      minimumDetectableEffect: delta,
      significanceLevel: alpha,
      statisticalPower: power,
      twoSided
    } = input;

    // Calculate p2 (variant conversion rate)
    const p2 = p1 * (1 + delta);
    
    if (p2 > 1) {
      throw new Error('Variant conversion rate cannot exceed 100%');
    }

    // Pooled proportion
    const pPooled = (p1 + p2) / 2;

    // Z-scores
    const zAlpha = twoSided ? 
      StatUtils.normalInv(1 - alpha / 2, 0, 1) : 
      StatUtils.normalInv(1 - alpha, 0, 1);
    const zBeta = StatUtils.normalInv(power, 0, 1);

    // Sample size calculation
    const numerator = Math.pow(zAlpha + zBeta, 2) * 
                     (pPooled * (1 - pPooled) + pPooled * (1 - pPooled));
    const denominator = Math.pow(p2 - p1, 2);

    const sampleSizePerVariant = Math.ceil(numerator / denominator);
    const totalSampleSize = sampleSizePerVariant * 2;

    return {
      sampleSizePerVariant,
      totalSampleSize
    };
  }

  // Enhanced sample size calculator with traffic estimation
  static calculateSampleSizeWithTraffic(
    input: SampleSizeCalculatorInput & { 
      dailyTrafficPerVariant?: number;
      weeklyTrafficPerVariant?: number;
    }
  ): SampleSizeResult {
    const result = this.calculateSampleSize(input);

    if (input.dailyTrafficPerVariant) {
      const expectedDuration = Math.ceil(result.sampleSizePerVariant / input.dailyTrafficPerVariant);
      result.expectedDuration = expectedDuration;
    } else if (input.weeklyTrafficPerVariant) {
      const expectedDuration = Math.ceil((result.sampleSizePerVariant / input.weeklyTrafficPerVariant) * 7);
      result.expectedDuration = expectedDuration;
    }

    return result;
  }

  // Frequentist Statistical Test (Z-test for proportions)
  static performZTest(input: StatisticalTestInput): StatisticalTestResult {
    const {
      controlConversions: x1,
      controlSampleSize: n1,
      variantConversions: x2,
      variantSampleSize: n2,
      significanceLevel = 0.05
    } = input;

    // Conversion rates
    const p1 = x1 / n1;
    const p2 = x2 / n2;

    // Pooled proportion
    const pPooled = (x1 + x2) / (n1 + n2);

    // Standard error
    const standardError = Math.sqrt(pPooled * (1 - pPooled) * (1/n1 + 1/n2));

    // Z-score
    const zScore = (p2 - p1) / standardError;

    // P-value (two-tailed)
    const pValue = 2 * (1 - StatUtils.normalCdf(Math.abs(zScore), 0, 1));

    // Statistical significance
    const isStatisticallySignificant = pValue < significanceLevel;

    // Confidence interval for difference in proportions
    const zCritical = StatUtils.normalInv(1 - significanceLevel / 2, 0, 1);
    const marginOfError = zCritical * standardError;
    const confidenceInterval = {
      lower: (p2 - p1) - marginOfError,
      upper: (p2 - p1) + marginOfError
    };

    // Lift calculation
    const lift = p1 > 0 ? ((p2 - p1) / p1) * 100 : 0;
    const liftStandardError = Math.sqrt((p2 * (1 - p2) / n2) + (p1 * (1 - p1) / n1)) / p1;
    const liftMarginOfError = zCritical * liftStandardError * 100;
    const liftConfidenceInterval = {
      lower: lift - liftMarginOfError,
      upper: lift + liftMarginOfError
    };

    // Relative risk and odds ratio
    const relativeRisk = p1 > 0 ? p2 / p1 : 0;
    const oddsRatio = (p1 > 0 && p1 < 1 && p2 > 0 && p2 < 1) ? 
      (p2 / (1 - p2)) / (p1 / (1 - p1)) : 0;

    return {
      pValue,
      zScore,
      isStatisticallySignificant,
      confidenceInterval,
      lift,
      liftConfidenceInterval,
      relativeRisk,
      oddsRatio
    };
  }

  // Bayesian A/B Test
  static performBayesianTest(input: BayesianTestInput): BayesianTestResult {
    const {
      controlConversions: x1,
      controlSampleSize: n1,
      variantConversions: x2,
      variantSampleSize: n2,
      priorAlpha = 1,
      priorBeta = 1
    } = input;

    // Posterior parameters
    const posteriorControl = {
      alpha: priorAlpha + x1,
      beta: priorBeta + n1 - x1
    };

    const posteriorVariant = {
      alpha: priorAlpha + x2,
      beta: priorBeta + n2 - x2
    };

    // Monte Carlo simulation to calculate probability that variant beats control
    const simulations = 10000;
    let variantWins = 0;
    const liftSamples = [];

    for (let i = 0; i < simulations; i++) {
      const controlSample = StatUtils.betaSample(posteriorControl.alpha, posteriorControl.beta);
      const variantSample = StatUtils.betaSample(posteriorVariant.alpha, posteriorVariant.beta);
      
      if (variantSample > controlSample) {
        variantWins++;
      }

      if (controlSample > 0) {
        liftSamples.push((variantSample - controlSample) / controlSample);
      }
    }

    const probabilityToBeatControl = variantWins / simulations;

    // Expected lift and credible interval
    liftSamples.sort((a, b) => a - b);
    const expectedLift = liftSamples.reduce((sum, val) => sum + val, 0) / liftSamples.length * 100;
    
    const credibleInterval = {
      lower: liftSamples[Math.floor(liftSamples.length * 0.025)] * 100,
      upper: liftSamples[Math.floor(liftSamples.length * 0.975)] * 100
    };

    return {
      probabilityToBeatControl,
      expectedLift,
      credibleInterval,
      posteriorControl,
      posteriorVariant
    };
  }

  // Power Analysis
  static performPowerAnalysis(input: PowerAnalysisInput): PowerAnalysisResult {
    const {
      controlConversionRate: p1,
      variantConversionRate: p2,
      sampleSizePerVariant: n,
      significanceLevel = 0.05
    } = input;

    // Effect size (Cohen's h for proportions)
    const effectSize = 2 * (Math.asin(Math.sqrt(p2)) - Math.asin(Math.sqrt(p1)));

    // Standard error under the null hypothesis
    const pPooled = (p1 + p2) / 2;
    const standardErrorNull = Math.sqrt(2 * pPooled * (1 - pPooled) / n);

    // Critical value
    const zCritical = StatUtils.normalInv(1 - significanceLevel / 2, 0, 1);
    const criticalValue = zCritical * standardErrorNull;

    // Standard error under the alternative hypothesis
    const standardErrorAlt = Math.sqrt((p1 * (1 - p1) + p2 * (1 - p2)) / n);

    // Non-centrality parameter
    const delta = Math.abs(p2 - p1);
    const ncp = delta / standardErrorAlt;

    // Power calculation
    const statisticalPower = 1 - StatUtils.normalCdf(zCritical - ncp, 0, 1) + 
                            StatUtils.normalCdf(-zCritical - ncp, 0, 1);

    // Minimum detectable effect
    const minimumDetectableEffect = (criticalValue * standardErrorAlt) / p1;

    return {
      statisticalPower,
      minimumDetectableEffect,
      isAdequatelyPowered: statisticalPower >= 0.8
    };
  }

  // Sequential Testing (with alpha spending)
  static performSequentialTest(
    input: StatisticalTestInput & {
      currentSampleRatio: number; // 0-1, how much of planned sample size collected
      totalPlannedSampleSize: number;
    }
  ) {
    const { currentSampleRatio, totalPlannedSampleSize } = input;

    // O'Brien-Fleming alpha spending function
    const spentAlpha = this.calculateAlphaSpent(currentSampleRatio, 0.05);

    // Adjusted significance level for current analysis
    const adjustedAlpha = spentAlpha;

    // Perform standard test with adjusted alpha
    const result = this.performZTest({
      ...input,
      significanceLevel: adjustedAlpha
    });

    return {
      ...result,
      adjustedSignificanceLevel: adjustedAlpha,
      spentAlpha,
      remainingAlpha: 0.05 - spentAlpha,
      recommendContinue: !result.isStatisticallySignificant && currentSampleRatio < 1.0
    };
  }

  // Multi-variant testing (ANOVA for proportions)
  static performMultiVariantTest(variants: Array<{
    name: string;
    conversions: number;
    sampleSize: number;
  }>) {
    if (variants.length < 2) {
      throw new Error('At least 2 variants required for testing');
    }

    // Calculate conversion rates
    const variantData = variants.map(v => ({
      ...v,
      conversionRate: v.conversions / v.sampleSize
    }));

    // Chi-square test for independence
    const totalConversions = variants.reduce((sum, v) => sum + v.conversions, 0);
    const totalSampleSize = variants.reduce((sum, v) => sum + v.sampleSize, 0);
    const overallConversionRate = totalConversions / totalSampleSize;

    let chiSquare = 0;
    const degreesOfFreedom = variants.length - 1;

    for (const variant of variants) {
      const expected = variant.sampleSize * overallConversionRate;
      chiSquare += Math.pow(variant.conversions - expected, 2) / expected;

      const expectedNonConversions = variant.sampleSize * (1 - overallConversionRate);
      const actualNonConversions = variant.sampleSize - variant.conversions;
      chiSquare += Math.pow(actualNonConversions - expectedNonConversions, 2) / expectedNonConversions;
    }

    const pValue = 1 - StatUtils.chiSquareCdf(chiSquare, degreesOfFreedom);
    const isStatisticallySignificant = pValue < 0.05;

    // Post-hoc pairwise comparisons (Bonferroni correction)
    const pairwiseComparisons = [];
    const bonferroniAlpha = 0.05 / (variants.length * (variants.length - 1) / 2);

    for (let i = 0; i < variants.length; i++) {
      for (let j = i + 1; j < variants.length; j++) {
        const comparison = this.performZTest({
          controlConversions: variants[i].conversions,
          controlSampleSize: variants[i].sampleSize,
          variantConversions: variants[j].conversions,
          variantSampleSize: variants[j].sampleSize,
          significanceLevel: bonferroniAlpha
        });

        pairwiseComparisons.push({
          variant1: variants[i].name,
          variant2: variants[j].name,
          ...comparison
        });
      }
    }

    return {
      overallTest: {
        chiSquare,
        degreesOfFreedom,
        pValue,
        isStatisticallySignificant
      },
      variantData,
      pairwiseComparisons,
      bonferroniAlpha
    };
  }

  // Helper method for alpha spending
  private static calculateAlphaSpent(fraction: number, totalAlpha: number): number {
    // O'Brien-Fleming spending function
    if (fraction <= 0) return 0;
    if (fraction >= 1) return totalAlpha;

    const z = StatUtils.normalInv(1 - totalAlpha / 2, 0, 1);
    const spent = 2 * (1 - StatUtils.normalCdf(z / Math.sqrt(fraction), 0, 1));
    
    return Math.min(spent, totalAlpha);
  }

  // Effect Size Calculations
  static calculateEffectSizes(controlRate: number, variantRate: number) {
    // Cohen's h for proportions
    const cohensH = 2 * (Math.asin(Math.sqrt(variantRate)) - Math.asin(Math.sqrt(controlRate)));

    // Relative risk
    const relativeRisk = controlRate > 0 ? variantRate / controlRate : 0;

    // Odds ratio
    const oddsRatio = (controlRate > 0 && controlRate < 1 && variantRate > 0 && variantRate < 1) ?
      (variantRate / (1 - variantRate)) / (controlRate / (1 - controlRate)) : 0;

    // Risk difference
    const riskDifference = variantRate - controlRate;

    // Number needed to treat/harm
    const nnt = riskDifference > 0 ? Math.round(1 / riskDifference) : null;

    return {
      cohensH,
      relativeRisk,
      oddsRatio,
      riskDifference,
      numberNeededToTreat: nnt
    };
  }
}

// Utility functions for common calculations
export const calculateConversionRate = (conversions: number, sampleSize: number): number => {
  return sampleSize > 0 ? conversions / sampleSize : 0;
};

export const calculateLift = (controlRate: number, variantRate: number): number => {
  return controlRate > 0 ? ((variantRate - controlRate) / controlRate) * 100 : 0;
};

export const formatPValue = (pValue: number): string => {
  if (pValue < 0.001) return '< 0.001';
  if (pValue < 0.01) return '< 0.01';
  if (pValue < 0.05) return '< 0.05';
  return pValue.toFixed(3);
};

export const formatConfidenceInterval = (interval: { lower: number; upper: number }): string => {
  return `[${interval.lower.toFixed(3)}, ${interval.upper.toFixed(3)}]`;
};

export const getSignificanceLevel = (pValue: number): 'high' | 'medium' | 'low' | 'none' => {
  if (pValue < 0.001) return 'high';
  if (pValue < 0.01) return 'medium';
  if (pValue < 0.05) return 'low';
  return 'none';
};

export default StatisticalAnalysis;
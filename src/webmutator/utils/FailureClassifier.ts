export enum FailureClass {
    NO_MATCH = 'NO_MATCH',
    MULTIPLE_MATCH = 'MULTIPLE_MATCH',
    ACTIONABILITY = 'ACTIONABILITY',
    ASSERTION = 'ASSERTION'
}

export enum ExecutionStage {
    ORACLE_PRECHECK = 'ORACLE_PRECHECK',
    ACTION = 'ACTION',
    ASSERTION = 'ASSERTION'
}

export interface StructuredEvidence {
    actionContextEntered: boolean;
    preActionResolutionObservation: number | 'unknown'; // > 0 implies resolution was possible before action
    uniquenessViolationObserved: boolean;
    actionAttemptStarted: boolean;
    actionCompleted: boolean;
    assertionStageEntered: boolean;
    oracleVerificationStarted: boolean;
    oracleVerificationCompleted: boolean;
    actionabilityFailureObserved: boolean;
    timeoutObserved: boolean;
    infrastructureFailureObserved: boolean;
    oracleIntegrityFailureObserved: boolean;
}

export interface ClassificationResult {
    runStatus: 'passed' | 'failed' | 'invalid';
    failureClass: FailureClass | null;
    failureStage: ExecutionStage | null;
    rawErrorName: string;
    rawErrorMessage: string;
    classifierReason: string;
    isTimeout: boolean;
    isStrictnessViolation: boolean;
    invalidRunReason?: string;
    evidence: StructuredEvidence;
}

export class FailureClassifier {
    static classify(error: Error | any, stage: ExecutionStage, evidence: StructuredEvidence): ClassificationResult {
        const errorMessage = error?.message || '';
        const errorName = error?.name || '';
        const stack = error?.stack || '';
        const fullText = errorMessage + '\n' + stack;
        
        const isTimeout = evidence.timeoutObserved || errorMessage.toLowerCase().includes('timeout') || errorName === 'TimeoutError';
        const isStrictnessViolation = 
            evidence.uniquenessViolationObserved || 
            errorMessage.includes('strict mode violation') || 
            (errorMessage.includes('resolved to') && errorMessage.includes('elements'));

        // Infrastructure check
        if (evidence.infrastructureFailureObserved || 
            errorMessage.includes('Target page, context or browser has been closed') ||
            errorMessage.includes('net::ERR_CONNECTION_REFUSED') ||
            errorMessage.includes('Navigation failed')) {
            return {
                runStatus: 'invalid',
                failureClass: null,
                failureStage: stage,
                rawErrorName: errorName,
                rawErrorMessage: errorMessage,
                classifierReason: 'Infrastructure or harness error detected',
                isTimeout,
                isStrictnessViolation,
                invalidRunReason: 'Infrastructure failure',
                evidence
            };
        }

        // Oracle Integrity check
        if (stage === ExecutionStage.ORACLE_PRECHECK || evidence.oracleIntegrityFailureObserved) {
            return {
                runStatus: 'invalid',
                failureClass: null,
                failureStage: stage,
                rawErrorName: errorName,
                rawErrorMessage: errorMessage,
                classifierReason: 'Oracle integrity failure (pre-action or corruption)',
                isTimeout,
                isStrictnessViolation,
                invalidRunReason: 'Oracle Integrity Error',
                evidence
            };
        }

        let failureClass: FailureClass | null = null;
        let reason = '';

        if (stage === ExecutionStage.ASSERTION) {
            failureClass = FailureClass.ASSERTION;
            reason = 'Failure during oracle postcondition verification';
        } else if (stage === ExecutionStage.ACTION) {
            // Strictness check first
            if (isStrictnessViolation || (typeof evidence.preActionResolutionObservation === 'number' && evidence.preActionResolutionObservation > 1)) {
                failureClass = FailureClass.MULTIPLE_MATCH;
                reason = 'Tested locator resolved to multiple elements';
            } else {
                // ACTIONABILITY vs NO_MATCH logic
                // Positive evidence for ACTIONABILITY:
                // 1. Resolution was observed (count > 0) OR logs say "resolved to"
                // 2. AND we have a timeout or explicit actionability error (hidden/disabled etc)
                
                const hasResolvedInLogs = fullText.includes('locator resolved to') || fullText.includes('resolved to <');
                const wasResolvedPreAction = typeof evidence.preActionResolutionObservation === 'number' && evidence.preActionResolutionObservation === 1;
                
                // If we explicitly saw it resolved, or the logs confirm it resolved, AND it failed later...
                if ((wasResolvedPreAction || hasResolvedInLogs) && isTimeout) {
                    failureClass = FailureClass.ACTIONABILITY;
                    reason = 'Tested locator resolved to unique target but action failed actionability (timeout)';
                } else if (errorMessage.includes('not visible') || errorMessage.includes('element is not attached') || errorMessage.includes('element is disabled')) {
                     // Explicit actionability error message implies it was found but bad state
                    failureClass = FailureClass.ACTIONABILITY;
                    reason = 'Tested locator resolved but encountered explicit actionability error';
                } else {
                    // Default fallback: If we didn't see it resolve, or it timed out waiting to resolve
                    failureClass = FailureClass.NO_MATCH;
                    reason = 'Tested locator failed to resolve to any element';
                }
            }
        }

        return {
            runStatus: 'failed',
            failureClass,
            failureStage: stage,
            rawErrorName: errorName,
            rawErrorMessage: errorMessage,
            classifierReason: reason,
            isTimeout,
            isStrictnessViolation,
            evidence
        };
    }

    static createEmptyEvidence(): StructuredEvidence {
        return {
            actionContextEntered: false,
            preActionResolutionObservation: 'unknown',
            uniquenessViolationObserved: false,
            actionAttemptStarted: false,
            actionCompleted: false,
            assertionStageEntered: false,
            oracleVerificationStarted: false,
            oracleVerificationCompleted: false,
            actionabilityFailureObserved: false,
            timeoutObserved: false,
            infrastructureFailureObserved: false,
            oracleIntegrityFailureObserved: false,
        };
    }
}

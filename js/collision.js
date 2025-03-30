// Contents of the new js/collision.js

// Note: This function now takes the 'units' array as an argument.

const COLLISION_BUFFER = 1.0; // Increased buffer space

export function handleCollisions(units) { // Pass units array
    for (let i = 0; i < units.length; i++) {
        for (let j = i + 1; j < units.length; j++) {
            const unitA = units[i];
            const unitB = units[j];

            // Skip collision check if either unit is dead OR broken (routing units ignore collision)
            if (unitA.isDead || unitB.isDead || unitA.isBroken || unitB.isBroken) continue;

            const dx = unitB.x - unitA.x;
            const dy = unitB.y - unitA.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const minDistance = unitA.radius + unitB.radius;

            if (distance < minDistance && distance > 0) {
                // --- Prevent Idle Vibration ---
                // Only apply separation if at least one unit is moving
                if (!unitA.isMoving && !unitB.isMoving) continue;
                // --- End Prevent Idle Vibration ---

                // Calculate how much to push units apart, including the buffer
                const targetSeparation = minDistance + COLLISION_BUFFER;
                const pushMagnitude = (targetSeparation - distance) / 2; // How much further each unit needs to move

                // Avoid division by zero if distance is exactly 0 (shouldn't happen with check above)
                const nx = distance > 0 ? dx / distance : 0; // Normalized collision vector x
                const ny = distance > 0 ? dy / distance : 0; // Normalized collision vector y

                // Calculate separation vector based on required push magnitude
                const separationX = nx * pushMagnitude;
                const separationY = ny * pushMagnitude;

                // Mass factors
                const totalMass = unitA.mass + unitB.mass;
                const moveFactorA = totalMass > 0 ? unitB.mass / totalMass : 0.5;
                const moveFactorB = totalMass > 0 ? unitA.mass / totalMass : 0.5;

                // --- Conditional Logic ---
                let applyStandardPushA = true;
                let applyStandardPushB = true;
                let stopMovingA = false;
                let stopMovingB = false;

                // Check for friendly collision
                if (unitA.team === unitB.team) {
                    // Determine mover (simple check: isMoving flag)
                    let mover = null;
                    let target = null;
                    if (unitA.isMoving && !unitB.isMoving) { mover = unitA; target = unitB; }
                    else if (unitB.isMoving && !unitA.isMoving) { mover = unitB; target = unitA; }
                    // If both/neither moving, treat A as mover for consistency (can refine later)
                    else { mover = unitA; target = unitB; }

                    if (mover.isTrained) {
                        const isTargetLocked = target.attackTarget !== null;
                        const isTargetHealthy = (target.currentHp / target.maxHp) >= 0.5;

                        if (isTargetLocked && isTargetHealthy) {
                            // Trained Deflect: Apply perpendicular push, don't stop mover
                            const perpX = -ny; // Perpendicular vector
                            const perpY = nx;
                            const pushStrength = overlap / 2; // Adjust as needed

                            // Apply deflection push mainly to the mover
                            if (mover === unitA) {
                                unitA.x += perpX * pushStrength * moveFactorA; // Apply perpendicular push
                                unitA.y += perpY * pushStrength * moveFactorA;
                                applyStandardPushA = false; // Don't apply standard push
                                // unitB might get a small standard push back
                            } else { // mover is unitB
                                unitB.x -= perpX * pushStrength * moveFactorB; // Apply perpendicular push (opposite dir)
                                unitB.y -= perpY * pushStrength * moveFactorB;
                                applyStandardPushB = false; // Don't apply standard push
                                // unitA might get a small standard push back
                            }
                            // console.log(`${mover.color} deflecting off ${target.color}`);

                        } else if (isTargetLocked && !isTargetHealthy) {
                            // Trained Bump & Stop: Apply standard push, stop mover
                            if (mover === unitA) stopMovingA = true;
                            else stopMovingB = true;
                            // console.log(`${mover.color} bumping and stopping against ${target.color}`);
                        } else {
                            // Target not locked: Apply standard push
                        }
                    } else {
                        // Untrained Mover: Apply standard push
                    }
                } // End friendly collision check

                // Apply standard push if not overridden by deflection
                if (applyStandardPushA && !unitA.isBroken) {
                    unitA.x -= separationX * moveFactorA;
                    unitA.y -= separationY * moveFactorA;
                }
                if (applyStandardPushB && !unitB.isBroken) {
                    unitB.x += separationX * moveFactorB;
                    unitB.y += separationY * moveFactorB;
                }

                // Stop mover if Bump & Stop condition met
                if (stopMovingA) unitA.isMoving = false;
                if (stopMovingB) unitB.isMoving = false;


                // Optional: Slightly adjust target if units collide while moving to prevent sticking (REMOVED for now, might conflict with deflection)
                // if (unitA.isMoving) unitA.targetX -= separationX * moveFactorA * 0.1;
                // if (unitA.isMoving) unitA.targetY -= separationY * moveFactorA * 0.1;
                // if (unitB.isMoving) unitB.targetX += separationX * moveFactorB * 0.1;
                // if (unitB.isMoving) unitB.targetY += separationY * moveFactorB * 0.1;

            }
        }
    }
}

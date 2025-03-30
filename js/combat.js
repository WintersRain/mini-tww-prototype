// Contents of the new js/combat.js

// Note: Depends on Unit class methods (attack) and passed-in state/functions.

export function handleCombat(units, logToFeed, damageFeedEl) { // Pass dependencies
    const leeway = 2; // Small buffer for touching check

    for (let i = 0; i < units.length; i++) {
        const attacker = units[i];
        if (attacker.isBroken || attacker.isDead) continue; // Broken or dead units don't fight

        // If currently fighting, check if target is still valid
        if (attacker.attackTarget) {
            if (attacker.attackTarget.isDead || attacker.attackTarget.isBroken) { // Check isDead flag too
                attacker.attackTarget = null; // Target died or broke, find new one
            } else {
                 const dx = attacker.attackTarget.x - attacker.x;
                 const dy = attacker.attackTarget.y - attacker.y;
                 const dist = Math.sqrt(dx*dx + dy*dy);

                 // Check if target is still in valid engagement range (primary or touching)
                 const primaryEngagementDistTarget = attacker.attackRange + (attacker.attackTarget.radius / 2);
                 const touchingDistTarget = attacker.radius + attacker.attackTarget.radius;

                 if (!(dist < primaryEngagementDistTarget || dist < touchingDistTarget + leeway)) {
                     attacker.attackTarget = null; // Target moved out of valid range
                 } else {
                    // Still in valid range, keep attacking
                    // Pass logToFeed and damageFeedEl to the attack method
                    attacker.attack(attacker.attackTarget, logToFeed, damageFeedEl);
                    attacker.isMoving = false; // Ensure unit stops moving while attacking
                    continue; // Skip finding a new target
                 }
            }
        }


        // Find the closest enemy target if not currently engaged
        let closestTarget = null;
        // Initialize minDistanceSq to a very large value, we'll check range inside the loop
        let minDistanceSq = Infinity;

        for (let j = 0; j < units.length; j++) {
            if (i === j) continue; // Don't target self
            const potentialTarget = units[j];

            // Check if potential target is on the opposing team and not broken/dead
            if (potentialTarget.team !== attacker.team && !potentialTarget.isBroken && !potentialTarget.isDead) {
                const dx = potentialTarget.x - attacker.x;
                const dy = potentialTarget.y - attacker.y;
                const distanceSq = dx * dx + dy * dy;
                const distance = Math.sqrt(distanceSq); // Need actual distance for checks

                // Calculate engagement conditions
                const primaryEngagementDist = attacker.attackRange + (potentialTarget.radius / 2);
                const touchingDist = attacker.radius + potentialTarget.radius;

                // Check if target is valid based on new rules (primary range OR touching)
                const isInValidRange = (distance < primaryEngagementDist || distance < touchingDist + leeway);

                // If it's in valid range AND closer than the current best, select it
                if (isInValidRange && distanceSq < minDistanceSq) {
                    minDistanceSq = distanceSq;
                    closestTarget = potentialTarget;
                }
            }
        }

        // If a target was found in range, engage
        if (closestTarget) {
            attacker.attackTarget = closestTarget;
            attacker.isMoving = false; // Stop moving to engage
            // Pass logToFeed and damageFeedEl to the attack method
            attacker.attack(attacker.attackTarget, logToFeed, damageFeedEl); // Attack immediately if cooldown allows
        }
    }
}

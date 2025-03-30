// Contents of the new js/unit.js

// Note: This class now depends on external state/functions being passed into its methods (ctx, selectedUnits, canvas, logToFeed, damageFeedEl)
// This is a common pattern during refactoring.

export class Unit {
    constructor(x, y, radius, color, hp, morale, speed, attackDamage, mass) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.maxHp = hp;
        this.currentHp = hp;
        this.maxMorale = morale;
        this.currentMorale = morale;
        this.speed = speed;
        this.attackDamage = attackDamage;
        this.mass = mass; // Larger radius could imply higher mass

        this.targetX = x;
        this.targetY = y;
        this.isMoving = false;
        this.isBroken = false; // Morale state
        this.attackTarget = null; // Track who the unit is fighting
        this.attackCooldown = 0; // Time until next attack
        this.attackRange = this.radius + 15; // Increased engagement range
        this.attackSpeed = 1.0; // Attacks per second (lower is faster)
        // Assign team based on color
        if (color === 'blue') {
            this.team = 'player';
        } else if (color === 'red') {
            this.team = 'enemy';
        }
        this.isDead = false; // Flag to prevent multiple kill logs
        this.loggedKill = false; // Added flag from previous step
        this.lastAttacker = null; // Track who last hit this unit
        this.isRouting = false; // Is the unit currently fleeing?
        this.fleeDirectionX = 0; // Store flee vector
        this.fleeDirectionY = 0;
    }

    // Keeping draw, update, moveTo, takeDamage, attack as methods for now
    // They now require necessary external state/functions to be passed in.

    draw(ctx, selectedUnits) { // Pass context and selection state
        // Draw unit circle
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.isBroken ? '#888' : this.color; // Grey out if broken
        ctx.fill();
        // Highlight if this unit is in the selectedUnits array
        const isSelected = selectedUnits.includes(this);
        ctx.strokeStyle = isSelected ? 'yellow' : 'black';
        ctx.lineWidth = isSelected ? 3 : 1;
        ctx.stroke();
        ctx.closePath();

        // Draw HP bar
        const hpBarWidth = this.radius * 1.5;
        const hpBarHeight = 5;
        const hpBarX = this.x - hpBarWidth / 2;
        const hpBarY = this.y - this.radius - hpBarHeight * 3; // Position above unit
        ctx.fillStyle = '#333'; // Background
        ctx.fillRect(hpBarX, hpBarY, hpBarWidth, hpBarHeight);
        ctx.fillStyle = 'red'; // Current HP
        const currentHpWidth = (this.currentHp / this.maxHp) * hpBarWidth;
        ctx.fillRect(hpBarX, hpBarY, currentHpWidth > 0 ? currentHpWidth : 0, hpBarHeight);

        // Draw Morale bar
        const moraleBarY = hpBarY + hpBarHeight + 2; // Below HP bar
        ctx.fillStyle = '#333'; // Background
        ctx.fillRect(hpBarX, moraleBarY, hpBarWidth, hpBarHeight);
        ctx.fillStyle = 'cyan'; // Current Morale
        const currentMoraleWidth = (this.currentMorale / this.maxMorale) * hpBarWidth;
        ctx.fillRect(hpBarX, moraleBarY, currentMoraleWidth > 0 ? currentMoraleWidth : 0, hpBarHeight);
    }

    update(deltaTime, canvas, units) { // Accept units array
        // Attack Cooldown
        if (this.attackCooldown > 0) {
            this.attackCooldown -= deltaTime;
        }

        // Movement logic - Allow movement if routing OR if not broken and not fighting
        if (this.isMoving && (this.isRouting || (!this.isBroken && !this.attackTarget))) {
            const dx = this.targetX - this.x;
            const dy = this.targetY - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            let nextX = this.x;
            let nextY = this.y;

            if (distance > this.speed * deltaTime) {
                const moveX = (dx / distance) * this.speed * deltaTime;
                const moveY = (dy / distance) * this.speed * deltaTime;
                nextX += moveX;
                nextY += moveY;
            } else {
                nextX = this.targetX;
                nextY = this.targetY;
                this.isMoving = false;
            }

            // --- Boundary Constraints ---
            if (canvas) { // Check if canvas was passed
                if (nextX - this.radius < 0) {
                    nextX = this.radius; this.isMoving = false;
                } else if (nextX + this.radius > canvas.width) {
                    nextX = canvas.width - this.radius; this.isMoving = false;
                }
                if (nextY - this.radius < 0) {
                    nextY = this.radius; this.isMoving = false;
                } else if (nextY + this.radius > canvas.height) {
                    nextY = canvas.height - this.radius; this.isMoving = false;
                }
            }

            this.x = nextX;
            this.y = nextY;
            this.x = nextX;
            this.y = nextY;
            // --- End Boundary Constraints ---

            // Check if routing unit reached its flee point AFTER position is updated
            if (this.isRouting && !this.isMoving) {
                 // Call checkAndStopRouting, passing the necessary arguments
                 this.checkAndStopRouting(canvas, units);
            }

        } else if (this.attackTarget) {
             // Stop moving if we have an attack target
             this.isMoving = false;
        }


        // Basic Morale check
        if (this.currentMorale <= 0 && !this.isBroken) {
            this.isBroken = true;
            this.attackTarget = null; // Stop fighting
            this.isMoving = false; // Stop current movement initially
            console.log(`${this.color} unit broken!`);

            if (this.lastAttacker && !this.lastAttacker.isDead) {
                console.log(`...routing from ${this.lastAttacker.color}`);
                const fleeDX = this.x - this.lastAttacker.x;
                const fleeDY = this.y - this.lastAttacker.y;
                const fleeDist = Math.sqrt(fleeDX * fleeDX + fleeDY * fleeDY);

                if (fleeDist > 0) {
                    this.fleeDirectionX = fleeDX / fleeDist;
                    this.fleeDirectionY = fleeDY / fleeDist;
                } else {
                    // Flee in a random direction if distance is 0
                    const randomAngle = Math.random() * Math.PI * 2;
                    this.fleeDirectionX = Math.cos(randomAngle);
                    this.fleeDirectionY = Math.sin(randomAngle);
                }

                const fleeDistance = 100; // How far to flee initially
                let fleeTargetX = this.x + this.fleeDirectionX * fleeDistance;
                let fleeTargetY = this.y + this.fleeDirectionY * fleeDistance;

                // Clamp flee target to canvas bounds (simple clamp)
                fleeTargetX = Math.max(this.radius, Math.min(canvas.width - this.radius, fleeTargetX));
                fleeTargetY = Math.max(this.radius, Math.min(canvas.height - this.radius, fleeTargetY));

                this.targetX = fleeTargetX;
                this.targetY = fleeTargetY;
                this.isMoving = true;
                this.isRouting = true;
                this.lastAttacker = null; // Clear last attacker after starting rout
            } else {
                // Broke from morale shock or attacker died, just stand there broken
                this.isRouting = false;
            }
        }
    }

    // New method to check overlap and decide whether to stop routing
    checkAndStopRouting(canvas, units) { // Accept units array
        if (!units) {
             console.error("Units array not passed to checkAndStopRouting for unit:", this.color);
             this.isRouting = false; // Stop routing if we can't check
             this.isMoving = false;
             return;
        }

        let overlapping = false;
        for (const otherUnit of units) {
            if (otherUnit === this || otherUnit.isDead || otherUnit.isBroken) continue;

            const dx = otherUnit.x - this.x;
            const dy = otherUnit.y - this.y;
            const distSq = dx * dx + dy * dy;
            const minDistSq = (this.radius + otherUnit.radius) * (this.radius + otherUnit.radius);

            if (distSq < minDistSq) {
                overlapping = true;
                break;
            }
        }

        if (overlapping) {
            // Still overlapping, calculate new flee point further away
            console.log(`${this.color} routing unit still overlapping, continuing flee.`);
            const fleeDistance = 50; // Flee further
            let fleeTargetX = this.x + this.fleeDirectionX * fleeDistance;
            let fleeTargetY = this.y + this.fleeDirectionY * fleeDistance;

            // Clamp flee target to canvas bounds
            fleeTargetX = Math.max(this.radius, Math.min(canvas.width - this.radius, fleeTargetX));
            fleeTargetY = Math.max(this.radius, Math.min(canvas.height - this.radius, fleeTargetY));

            // If clamped target is same as current position (stuck in corner), stop routing anyway
            if (Math.abs(fleeTargetX - this.x) < 1 && Math.abs(fleeTargetY - this.y) < 1) {
                 console.log(`${this.color} routing unit stuck, stopping rout.`);
                 this.isRouting = false;
                 this.isMoving = false;
            } else {
                this.targetX = fleeTargetX;
                this.targetY = fleeTargetY;
                this.isMoving = true; // Continue moving
            }
        } else {
            // Not overlapping, stop routing
            console.log(`${this.color} routing unit found clear space, stopping rout.`);
            this.isRouting = false;
            this.isMoving = false;
        }
    }


    moveTo(x, y) {
        if (!this.isBroken && !this.isDead) { // Added !isDead check
            this.targetX = x;
            this.targetY = y;
            this.isMoving = true;
        }
    }

    takeDamage(amount, attacker = null) { // Accept attacker argument
        if (this.isDead) return;

        // Store the last unit that dealt damage
        if (attacker) {
            this.lastAttacker = attacker;
        }

        const damageTaken = Math.round(amount);
        this.currentHp -= damageTaken;
        this.currentMorale -= damageTaken * 0.5;

        // console.log(`DEBUG: ${this.color} unit took ${damageTaken} damage. New HP: ${this.currentHp}`);

        if (this.currentHp < 0) this.currentHp = 0;
        if (this.currentMorale < 0) this.currentMorale = 0;

        if (this.currentHp <= 0) {
            this.isDead = true;
        }
    }

    attack(target, logToFeed, damageFeedEl) {
        // console.log(`DEBUG: ${this.color} attempting attack on ${target ? target.color : 'null target'}`);

        if (this.attackCooldown <= 0 && !this.isBroken && target && !target.isBroken && !target.isDead) {
            const damageDealt = this.attackDamage;
            target.takeDamage(damageDealt, this); // Pass attacker (this) to takeDamage
            if (logToFeed && damageFeedEl) {
                 logToFeed(damageFeedEl, `${this.color} (${this.team}) dealt ${damageDealt} dmg to ${target.color} (${target.team})`);
            }
            this.attackCooldown = 1 / this.attackSpeed;
        }
    }
}

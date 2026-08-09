// Main Webinar Wizard and 3D Controller — Mind You Mental Health

document.addEventListener('DOMContentLoaded', () => {
  initThreeJS();
  initWizardForm();
});

/* =========================================================================
   3D Ambient Background (Three.js) - Organic Morphing Waves & Healing Orbs
   ========================================================================= */
function initThreeJS() {
  const canvas = document.getElementById('webgl-canvas');
  if (!canvas) return;

  let scene, camera, renderer;
  let organicBlobs = [];
  let stars;
  let mouseX = 0, mouseY = 0;
  let targetX = 0, targetY = 0;

  const windowHalfX = window.innerWidth / 2;
  const windowHalfY = window.innerHeight / 2;

  try {
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a1211, 0.018);

    camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.z = window.innerWidth < 768 ? 38 : 30;

    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Ambient & Breathing Point Lights
    const ambientLight = new THREE.AmbientLight(0x101c1a, 1.6);
    scene.add(ambientLight);

    // Sacred Teal Point Light (Safety)
    const tealLight = new THREE.PointLight(0x4FA3A0, 4.0, 60);
    tealLight.position.set(16, 12, 6);
    scene.add(tealLight);

    // Olive Sage Point Light (Growth)
    const sageLight = new THREE.PointLight(0x7A8F6A, 3.5, 55);
    sageLight.position.set(-16, -10, 6);
    scene.add(sageLight);

    // Soft Gold Point Light (Hope)
    const goldLight = new THREE.PointLight(0xE6C766, 3.5, 50);
    goldLight.position.set(0, -8, 10);
    scene.add(goldLight);

    // Organic Morphing Shapes Setup
    const blobConfigs = [
      { size: 4.8, speed: 0.0015, color: 0x2E7D78, px: -12, py: 6, pz: -4 },   // Sacred Teal
      { size: 5.5, speed: 0.002, color: 0x7A8F6A, px: 14, py: -8, pz: -7 },   // Olive Sage
      { size: 3.8, speed: 0.0025, color: 0xE6C766, px: 0, py: 12, pz: -6 },   // Soft Gold
      { size: 3.2, speed: 0.0018, color: 0x4FA3A0, px: -9, py: -10, pz: -3 }, // Light Teal
      { size: 6.2, speed: 0.001, color: 0x5F7252, px: 3, py: -5, pz: -12 }    // Dark Sage
    ];

    blobConfigs.forEach(config => {
      // High detail icosahedron for fluid vertex morphing
      const geometry = new THREE.IcosahedronGeometry(config.size, 16);
      
      // Save original vertex positions for trigonometric wave distortion
      const posAttribute = geometry.attributes.position;
      const initialPositions = new Float32Array(posAttribute.count * 3);
      for (let i = 0; i < posAttribute.count * 3; i++) {
        initialPositions[i] = posAttribute.array[i];
      }
      geometry.userData = { initialPositions: initialPositions };

      const material = new THREE.MeshPhysicalMaterial({
        color: config.color,
        roughness: 0.15,
        metalness: 0.08,
        transparent: true,
        opacity: 0.38,
        transmission: 0.6,
        ior: 1.4,
        thickness: 2.5,
        specularIntensity: 1.0,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(config.px, config.py, config.pz);
      scene.add(mesh);

      organicBlobs.push({
        mesh: mesh,
        originalX: config.px,
        originalY: config.py,
        speed: config.speed,
        timeOffset: Math.random() * 100
      });
    });

    // Soft Gold & Sage Stardust Particles
    const starCount = 200;
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount * 3; i += 3) {
      starPositions[i] = (Math.random() - 0.5) * 80;
      starPositions[i + 1] = (Math.random() - 0.5) * 60;
      starPositions[i + 2] = (Math.random() - 0.5) * 40;
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));

    const pCanvas = document.createElement('canvas');
    pCanvas.width = 16;
    pCanvas.height = 16;
    const pCtx = pCanvas.getContext('2d');
    const grad = pCtx.createRadialGradient(8, 8, 0, 8, 8, 8);
    grad.addColorStop(0, 'rgba(230, 199, 102, 1)'); // Gold glow
    grad.addColorStop(1, 'rgba(230, 199, 102, 0)');
    pCtx.fillStyle = grad;
    pCtx.fillRect(0, 0, 16, 16);

    const starTexture = new THREE.CanvasTexture(pCanvas);
    const starMaterial = new THREE.PointsMaterial({
      size: 0.55,
      map: starTexture,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    // Mouse Parallax Track
    window.addEventListener('mousemove', (event) => {
      mouseX = (event.clientX - windowHalfX) * 0.04;
      mouseY = (event.clientY - windowHalfY) * 0.04;
    });

    // Touch Parallax Track for Mobile Devices
    window.addEventListener('touchmove', (event) => {
      if (event.touches.length > 0) {
        mouseX = (event.touches[0].clientX - windowHalfX) * 0.04;
        mouseY = (event.touches[0].clientY - windowHalfY) * 0.04;
      }
    }, { passive: true });

    // Responsive Canvas Resize
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.position.z = window.innerWidth < 768 ? 38 : 30;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Render loop with Organic Morphing Mathematics
    let clock = new THREE.Clock();

    const animate = () => {
      requestAnimationFrame(animate);

      const time = clock.getElapsedTime();

      targetX += (mouseX - targetX) * 0.05;
      targetY += (mouseY - targetY) * 0.05;

      camera.position.x = targetX * 0.08;
      camera.position.y = -targetY * 0.08;
      camera.lookAt(scene.position);

      // Light breathing intensity
      tealLight.intensity = 3.5 + Math.sin(time * 0.8) * 0.8;
      sageLight.intensity = 3.0 + Math.cos(time * 0.7) * 0.6;
      goldLight.intensity = 3.2 + Math.sin(time * 0.9) * 0.7;

      if (stars) {
        stars.rotation.y += 0.0003;
        stars.rotation.x += 0.0001;
      }

      // Morph organic blob vertices over time (breathing liquid wave effect)
      organicBlobs.forEach(blob => {
        const mesh = blob.mesh;
        const geom = mesh.geometry;
        const posAttr = geom.attributes.position;
        const initial = geom.userData.initialPositions;
        const t = time + blob.timeOffset;

        for (let i = 0; i < posAttr.count; i++) {
          const u = initial[i * 3];
          const v = initial[i * 3 + 1];
          const w = initial[i * 3 + 2];

          // Compute gentle wave distortion along normal vector
          const wave = Math.sin(u * 0.5 + t * 1.5) * 0.25 + Math.cos(v * 0.5 + t * 1.2) * 0.25;

          posAttr.array[i * 3] = u + u * wave * 0.08;
          posAttr.array[i * 3 + 1] = v + v * wave * 0.08;
          posAttr.array[i * 3 + 2] = w + w * wave * 0.08;
        }

        posAttr.needsUpdate = true;

        // Slow spatial orbit & rotation
        mesh.position.x = blob.originalX + Math.sin(t * 0.4) * 1.8;
        mesh.position.y = blob.originalY + Math.cos(t * 0.3) * 1.8;
        mesh.rotation.x += 0.0015;
        mesh.rotation.y += 0.002;
      });

      renderer.render(scene, camera);
    };

    animate();

  } catch (e) {
    console.warn("WebGL initialization skipped.", e);
  }
}

/* =========================================================================
   Wizard Form Controller
   ========================================================================= */
function initWizardForm() {
  const form = document.getElementById('registration-form');
  const steps = Array.from(document.querySelectorAll('.form-step'));
  const nextBtns = document.querySelectorAll('.btn-next');
  const prevBtns = document.querySelectorAll('.btn-prev');
  const stepNodes = Array.from(document.querySelectorAll('.step-node'));
  const progressLineFill = document.getElementById('progress-line-fill');
  
  const formContainer = document.getElementById('form-container');
  const successContainer = document.getElementById('success-container');
  const generalFormError = document.getElementById('general-form-error');
  const submitBtn = document.getElementById('submit-btn');
  const btnSpinner = document.getElementById('btn-spinner');

  let currentStep = 1;

  setupConditionalInputs();

  nextBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (validateStep(currentStep)) {
        currentStep++;
        updateWizard();
      }
    });
  });

  prevBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      currentStep--;
      updateWizard();
    });
  });

  form.querySelectorAll('input, textarea, checkbox').forEach(input => {
    input.addEventListener('input', () => clearError(input.name));
    input.addEventListener('change', () => clearError(input.name));
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError('general');

    if (!validateStep(currentStep)) return;

    submitBtn.disabled = true;
    btnSpinner.classList.remove('hide');
    generalFormError.classList.add('hide');

    const formData = getFormData();

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        formContainer.classList.add('hide');
        successContainer.classList.remove('hide');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        showError('general', result.error || 'Failed to complete registration. Please check your form.');
        submitBtn.disabled = false;
        btnSpinner.classList.add('hide');
      }
    } catch (error) {
      showError('general', 'A network error occurred. Please check your connection.');
      submitBtn.disabled = false;
      btnSpinner.classList.add('hide');
    }
  });

  function updateWizard() {
    document.querySelector('.wizard-card').scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    steps.forEach((step, idx) => {
      if (idx + 1 === currentStep) {
        step.classList.add('active');
      } else {
        step.classList.remove('active');
      }
    });

    stepNodes.forEach((node, idx) => {
      const stepNum = idx + 1;
      node.className = 'step-node';
      if (stepNum === currentStep) {
        node.classList.add('active');
      } else if (stepNum < currentStep) {
        node.classList.add('completed');
      }
    });

    const fillPercent = ((currentStep - 1) / (steps.length - 1)) * 100;
    progressLineFill.style.width = `${fillPercent}%`;
  }

  function showError(fieldName, msg) {
    if (fieldName === 'general') {
      generalFormError.textContent = msg;
      generalFormError.classList.remove('hide');
      return;
    }
    const errorSpan = document.getElementById(`error-${fieldName}`);
    if (errorSpan) {
      errorSpan.textContent = msg;
    }
    const inputElement = document.getElementsByName(fieldName)[0] || document.getElementById(fieldName);
    if (inputElement) {
      inputElement.classList.add('invalid');
    }
  }

  function clearError(fieldName) {
    if (fieldName === 'general') {
      generalFormError.textContent = '';
      generalFormError.classList.add('hide');
      return;
    }
    const errorSpan = document.getElementById(`error-${fieldName}`);
    if (errorSpan) {
      errorSpan.textContent = '';
    }
    const inputs = document.getElementsByName(fieldName);
    inputs.forEach(input => input.classList.remove('invalid'));
    const singleInput = document.getElementById(fieldName);
    if (singleInput) singleInput.classList.remove('invalid');
  }

  function validateStep(step) {
    let isValid = true;

    if (step === 1) {
      const fullName = document.getElementById('fullName').value.trim();
      if (!fullName) {
        showError('fullName', 'Full Name (including Middle Name) is required.');
        isValid = false;
      } else if (fullName.length < 3) {
        showError('fullName', 'Full Name must be at least 3 characters.');
        isValid = false;
      } else {
        clearError('fullName');
      }

      const email = document.getElementById('email').value.trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email) {
        showError('email', 'Email Address is required.');
        isValid = false;
      } else if (!emailRegex.test(email)) {
        showError('email', 'Please enter a valid email address.');
        isValid = false;
      } else {
        clearError('email');
      }

      const phone = document.getElementById('phone').value.trim();
      if (!phone) {
        showError('phone', 'Phone Number is required.');
        isValid = false;
      } else if (phone.length < 5) {
        showError('phone', 'Please enter a valid phone number.');
        isValid = false;
      } else {
        clearError('phone');
      }

      const country = document.getElementById('country').value.trim();
      if (!country) {
        showError('country', 'Country of Residence is required.');
        isValid = false;
      } else {
        clearError('country');
      }

      const ageSelected = document.querySelector('input[name="ageRange"]:checked');
      if (!ageSelected) {
        showError('ageRange', 'Please select your age range.');
        isValid = false;
      } else {
        clearError('ageRange');
      }

      clearError('gender');
    }

    else if (step === 2) {
      const descSelected = document.querySelector('input[name="description"]:checked');
      if (!descSelected) {
        showError('description', 'Please select the category that best describes you.');
        isValid = false;
      } else {
        clearError('description');
        if (descSelected.value === 'Other') {
          const descOther = document.getElementById('descriptionOther').value.trim();
          if (!descOther) {
            showError('descriptionOther', 'Please specify details.');
            isValid = false;
          } else {
            clearError('descriptionOther');
          }
        }
      }

      const religionSelected = document.querySelector('input[name="religion"]:checked');
      if (!religionSelected) {
        showError('religion', 'Please select your religion or faith background.');
        isValid = false;
      } else {
        clearError('religion');
        if (religionSelected.value === 'Other') {
          const religionOther = document.getElementById('religionOther').value.trim();
          if (!religionOther) {
            showError('religionOther', 'Please specify your religion or faith background.');
            isValid = false;
          } else {
            clearError('religionOther');
          }
        }
      }
    }

    else if (step === 3) {
      const referralSelected = document.querySelector('input[name="referralChannel"]:checked');
      if (!referralSelected) {
        showError('referralChannel', 'Please select how you heard about us.');
        isValid = false;
      } else {
        clearError('referralChannel');
        if (referralSelected.value === 'Other') {
          const refOther = document.getElementById('referralChannelOther').value.trim();
          if (!refOther) {
            showError('referralChannelOther', 'Please specify details.');
            isValid = false;
          } else {
            clearError('referralChannelOther');
          }
        }
      }

      const reasonsChecked = document.querySelectorAll('input[name="reasons"]:checked');
      if (reasonsChecked.length === 0) {
        showError('reasons', 'Please select at least one reason.');
        isValid = false;
      } else {
        clearError('reasons');
        const isOtherChecked = Array.from(reasonsChecked).some(chk => chk.value === 'Other.');
        if (isOtherChecked) {
          const reasonsOther = document.getElementById('reasonsOther').value.trim();
          if (!reasonsOther) {
            showError('reasonsOther', 'Please specify your other reasons.');
            isValid = false;
          } else {
            clearError('reasonsOther');
          }
        }
      }

      const topicSelected = document.querySelector('input[name="topicOfInterest"]:checked');
      if (!topicSelected) {
        showError('topicOfInterest', 'Please select the topic of most interest.');
        isValid = false;
      } else {
        clearError('topicOfInterest');
      }
    }

    else if (step === 4) {
      const speakerQuestion = document.getElementById('speakerQuestion').value;
      if (speakerQuestion.length > 500) {
        showError('speakerQuestion', 'Question must not exceed 500 characters.');
        isValid = false;
      } else {
        clearError('speakerQuestion');
      }

      const attendedSelected = document.querySelector('input[name="attendedBefore"]:checked');
      if (!attendedSelected) {
        showError('attendedBefore', 'Please select Yes or No.');
        isValid = false;
      } else {
        clearError('attendedBefore');
      }

      for (let i = 1; i <= 5; i++) {
        const qSelected = document.querySelector(`input[name="preAssessmentQ${i}"]:checked`);
        if (!qSelected) {
          showError(`preAssessmentQ${i}`, `Please rate statement ${i}.`);
          isValid = false;
        } else {
          clearError(`preAssessmentQ${i}`);
        }
      }
    }

    else if (step === 5) {
      const updatesConsent = document.getElementById('consentUpdates').checked;
      if (!updatesConsent) {
        showError('consentUpdates', 'You must agree to receive reminders to complete registration.');
        isValid = false;
      } else {
        clearError('consentUpdates');
      }

      const recordingConsent = document.getElementById('consentRecording').checked;
      if (!recordingConsent) {
        showError('consentRecording', 'You must agree to the recording terms.');
        isValid = false;
      } else {
        clearError('consentRecording');
      }
    }

    return isValid;
  }

  function setupConditionalInputs() {
    const descRadios = document.querySelectorAll('input[name="description"]');
    const descOtherContainer = document.getElementById('desc-other-container');
    descRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        if (radio.value === 'Other' && radio.checked) {
          descOtherContainer.classList.remove('hide');
        } else {
          descOtherContainer.classList.add('hide');
          clearError('descriptionOther');
        }
      });
    });

    const religionRadios = document.querySelectorAll('input[name="religion"]');
    const religionOtherContainer = document.getElementById('religion-other-container');
    religionRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        if (radio.value === 'Other' && radio.checked) {
          religionOtherContainer.classList.remove('hide');
        } else {
          religionOtherContainer.classList.add('hide');
          clearError('religionOther');
        }
      });
    });

    const refRadios = document.querySelectorAll('input[name="referralChannel"]');
    const refOtherContainer = document.getElementById('ref-other-container');
    refRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        if (radio.value === 'Other' && radio.checked) {
          refOtherContainer.classList.remove('hide');
        } else {
          refOtherContainer.classList.add('hide');
          clearError('referralChannelOther');
        }
      });
    });

    const reasonsOtherCheckbox = document.getElementById('reasons-other-checkbox');
    const reasonsOtherContainer = document.getElementById('reasons-other-container');
    if (reasonsOtherCheckbox) {
      reasonsOtherCheckbox.addEventListener('change', () => {
        if (reasonsOtherCheckbox.checked) {
          reasonsOtherContainer.classList.remove('hide');
        } else {
          reasonsOtherContainer.classList.add('hide');
          clearError('reasonsOther');
        }
      });
    }
  }

  function getFormData() {
    const data = {};
    
    data.fullName = document.getElementById('fullName').value.trim();
    data.email = document.getElementById('email').value.trim();
    data.phone = document.getElementById('phone').value.trim();
    data.country = document.getElementById('country').value.trim();
    
    const ageEl = document.querySelector('input[name="ageRange"]:checked');
    data.ageRange = ageEl ? ageEl.value : '';
    
    const genderEl = document.querySelector('input[name="gender"]:checked');
    data.gender = genderEl ? genderEl.value : '';

    const descEl = document.querySelector('input[name="description"]:checked');
    data.description = descEl ? descEl.value : '';
    data.descriptionOther = (data.description === 'Other') ? document.getElementById('descriptionOther').value.trim() : '';
    
    const religionEl = document.querySelector('input[name="religion"]:checked');
    data.religion = religionEl ? religionEl.value : '';
    data.religionOther = (data.religion === 'Other') ? document.getElementById('religionOther').value.trim() : '';

    const refEl = document.querySelector('input[name="referralChannel"]:checked');
    data.referralChannel = refEl ? refEl.value : '';
    data.referralChannelOther = (data.referralChannel === 'Other') ? document.getElementById('referralChannelOther').value.trim() : '';

    const reasonsChecked = document.querySelectorAll('input[name="reasons"]:checked');
    data.reasons = Array.from(reasonsChecked).map(chk => chk.value);
    data.reasonsOther = data.reasons.includes('Other.') ? document.getElementById('reasonsOther').value.trim() : '';

    const topicEl = document.querySelector('input[name="topicOfInterest"]:checked');
    data.topicOfInterest = topicEl ? topicEl.value : '';

    data.speakerQuestion = document.getElementById('speakerQuestion').value.trim();
    
    const attendedEl = document.querySelector('input[name="attendedBefore"]:checked');
    data.attendedBefore = attendedEl ? attendedEl.value : '';

    for (let i = 1; i <= 5; i++) {
      const qEl = document.querySelector(`input[name="preAssessmentQ${i}"]:checked`);
      data[`preAssessmentQ${i}`] = qEl ? qEl.value : '';
    }

    data.consentUpdates = document.getElementById('consentUpdates').checked;
    data.consentRecording = document.getElementById('consentRecording').checked;

    return data;
  }
}

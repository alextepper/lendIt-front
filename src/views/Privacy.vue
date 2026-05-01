<script setup>
import { onMounted } from 'vue';
import { useSeo, buildCanonical } from '../composables/useSeo';
import { notifyPrerenderReady } from '../composables/usePrerender';

useSeo({
  title: 'מדיניות פרטיות והסכם משתמש | Sharo',
  description:
    'מדיניות הפרטיות והסכם המשתמש של Sharo. למדו כיצד אנו מגנים על הנתונים האישיים שלכם וכיצד הפלטפורמה פועלת.',
  ogTitle: 'מדיניות פרטיות - Sharo',
  ogDescription: 'מדיניות הפרטיות והסכם המשתמש של פלטפורמת Sharo.',
  ogType: 'article',
  canonical: buildCanonical('/privacy'),
});

onMounted(() => notifyPrerenderReady());
</script>

<template>
  <div class="container py-4">
    <div class="row justify-content-center">
      <div class="col-lg-8">
        <h1 class="mb-3">Sharo &ndash; User Agreement &amp; Privacy Policy</h1>
        <p class="text-muted mb-3">Last updated: December 23, 2025</p>

        <div class="card">
          <div class="card-body">
            <p>
              This User Agreement and Privacy Policy (the &quot;Agreement&quot;) constitutes a legally binding agreement between you
              (&quot;User&quot;, &quot;you&quot;) and Sharo (&quot;Sharo&quot;, &quot;we&quot;, &quot;us&quot;, &quot;the Platform&quot;). By
              accessing or using the Platform, you confirm that you have read, understood, and agree to be bound by this Agreement.
            </p>
            <p>
              If you do not agree to this Agreement, you must immediately cease using the Platform.
            </p>

            <h5 class="mt-4 mb-2">1. Nature of the Platform</h5>
            <p>
              Sharo is a technology-only platform that enables Users to discover one another and communicate for the purpose of arranging
              peer‑to‑peer interactions.
            </p>
            <p>
              Sharo does not own, sell, rent, lend, broker, guarantee, insure, store, transport, or manage any items or services offered by Users.
              Sharo is not a party to any agreement, transaction, or interaction between Users. All agreements, communications, and transactions are
              concluded directly and exclusively between Users.
            </p>

            <h5 class="mt-4 mb-2">2. No Responsibility for Transactions or Communications</h5>
            <p>You acknowledge and agree that:</p>
            <ul>
              <li>Any transaction, payment, exchange, lending, rental, delivery, or meeting is conducted solely between Users.</li>
              <li>Sharo does not process payments, hold funds, or act as an agent, broker, trustee, or escrow service.</li>
              <li>
                Sharo bears no responsibility or liability for payment disputes or non‑payment; fraud, misrepresentation, or false statements; loss,
                theft, or damage to items; personal injury, bodily harm, or property damage; failure to perform, delays, or cancellations; or any
                breach of law by a User.
              </li>
              <li>All use of the Platform is at the User&rsquo;s own risk.</li>
            </ul>

            <h5 class="mt-4 mb-2">3. User‑to‑User Communications</h5>
            <p>
              All messages and communications exchanged via the Platform are private communications between Users. Sharo does not verify, monitor,
              endorse, or guarantee the accuracy, legality, or reliability of User communications and shall not be responsible for any consequences
              arising from such communications.
            </p>

            <h5 class="mt-4 mb-2">4. Restricted and Prohibited Items</h5>
            <p>The Platform may not be used to offer, request, transfer, lend, rent, or otherwise engage with:</p>
            <ul>
              <li>any item or service that is illegal under the laws of the State of Israel or any applicable law;</li>
              <li>items requiring a license, permit, or regulatory approval, unless the User holds such authorization;</li>
              <li>weapons, ammunition, explosives, or controlled substances;</li>
              <li>stolen, counterfeit, or unlawfully obtained items; or</li>
              <li>hazardous materials or items posing unreasonable safety risks.</li>
            </ul>
            <p>
              Each User is solely responsible for ensuring that any item or service offered or requested is lawful and permitted. Sharo reserves the
              right (but does not have an obligation) to remove content or restrict access where a suspected violation exists.
            </p>

            <h5 class="mt-4 mb-2">5. Responsibility for Items and Harm</h5>
            <p>You expressly agree that:</p>
            <ul>
              <li>Sharo has no responsibility or liability for the condition, safety, legality, or suitability of any item.</li>
              <li>
                Any damage to an item, loss of an item, or harm caused by an item (including personal injury or property damage) is the sole
                responsibility of the Users involved in the transaction.
              </li>
              <li>
                Sharo shall not be liable for any claim arising from the use, misuse, transport, storage, or condition of any item. All risks
                associated with items are assumed exclusively by the Users.
              </li>
            </ul>

            <h5 class="mt-4 mb-2">6. Personal Information &amp; Privacy</h5>

            <h6 class="mt-3 mb-2">6.1 Information Collected</h6>
            <p>Sharo may collect limited personal data necessary to operate the Platform, including:</p>
            <ul>
              <li>account details (such as name and email address);</li>
              <li>profile information voluntarily provided by Users;</li>
              <li>messages exchanged through the Platform; and</li>
              <li>technical and usage data (for example, IP address, device information, and log data).</li>
            </ul>
            <p>Sharo does not intentionally collect sensitive personal data.</p>

            <h6 class="mt-3 mb-2">6.2 Purpose of Processing</h6>
            <p>Personal data is processed solely for:</p>
            <ul>
              <li>providing and maintaining the Platform;</li>
              <li>enabling User accounts and communications;</li>
              <li>improving security and functionality; and</li>
              <li>complying with legal obligations.</li>
            </ul>
            <p>Sharo does not sell personal data.</p>

            <h6 class="mt-3 mb-2">6.3 User‑to‑User Data Sharing</h6>
            <p>
              Any personal data shared between Users is shared at the User&rsquo;s sole discretion. Sharo bears no responsibility for how other Users
              use such information.
            </p>

            <h6 class="mt-3 mb-2">6.4 Data Retention and Rights</h6>
            <p>
              Data is retained only as long as necessary for the operation of the Platform or to comply with legal obligations. Subject to applicable
              law, Users may request access, correction, or deletion of their personal data by contacting
              <a href="mailto:privacy@sharo-app.com">privacy@sharo-app.com</a>.
            </p>

            <h5 class="mt-4 mb-2">7. No Warranties</h5>
            <p>
              The Platform is provided &quot;as is&quot; and &quot;as available&quot;. Sharo disclaims all warranties, whether express or implied,
              including any warranties of merchantability, fitness for a particular purpose, and non‑infringement.
            </p>

            <h5 class="mt-4 mb-2">8. Limitation of Liability</h5>
            <p>To the maximum extent permitted by law:</p>
            <ul>
              <li>Sharo shall not be liable for any indirect, incidental, consequential, special, or punitive damages; and</li>
              <li>Sharo&rsquo;s total aggregate liability shall not exceed the amount paid by the User to Sharo in the preceding twelve (12) months, if any.</li>
            </ul>

            <h5 class="mt-4 mb-2">9. Indemnification</h5>
            <p>
              You agree to indemnify and hold harmless Sharo, its owners, directors, employees, and partners from any claim, demand, loss, liability,
              or expense (including reasonable attorneys&rsquo; fees) arising out of or related to: (a) your use of the Platform; (b) your
              transactions or interactions with other Users; or (c) your violation of this Agreement or any applicable law.
            </p>

            <h5 class="mt-4 mb-2">10. Termination</h5>
            <p>
              Sharo may suspend or terminate your access to the Platform at its sole discretion, at any time and for any reason, including to protect
              legal or operational interests, without any liability to you.
            </p>

            <h5 class="mt-4 mb-2">11. Governing Law and Jurisdiction</h5>
            <p>
              This Agreement shall be governed by and construed in accordance with the laws of the State of Israel. The courts of Tel Aviv‑Yafo,
              Israel, shall have exclusive jurisdiction over any dispute arising out of or in connection with this Agreement or your use of the
              Platform.
            </p>

            <h5 class="mt-4 mb-2">12. Contact</h5>
            <p>
              For legal inquiries, please contact us at <a href="mailto:legal@sharo-app.com">legal@sharo-app.com</a>. For privacy-related inquiries,
              please contact us at <a href="mailto:privacy@sharo-app.com">privacy@sharo-app.com</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>


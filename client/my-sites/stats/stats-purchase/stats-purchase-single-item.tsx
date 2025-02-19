import config from '@automattic/calypso-config';
import page from '@automattic/calypso-router';
import { Button as CalypsoButton } from '@automattic/components';
import { Button, CheckboxControl } from '@wordpress/components';
import { useTranslate } from 'i18n-calypso';
import React, { useState, useCallback } from 'react';
import { recordTracksEvent } from 'calypso/lib/analytics/tracks';
import { useSelector } from 'calypso/state';
import getIsSiteWPCOM from 'calypso/state/selectors/is-site-wpcom';
import { isJetpackSite, getSiteAdminUrl } from 'calypso/state/sites/selectors';
import useStatsPurchases from '../hooks/use-stats-purchases';
import { StatsCommercialUpgradeSlider, getTierQuentity } from './stats-commercial-upgrade-slider';
import gotoCheckoutPage from './stats-purchase-checkout-redirect';
import PersonalPurchase from './stats-purchase-personal';
import {
	StatsCommercialPriceDisplay,
	StatsBenefitsCommercial,
	StatsSingleItemPagePurchaseFrame,
	StatsSingleItemCard,
} from './stats-purchase-shared';
import {
	MIN_STEP_SPLITS,
	DEFAULT_STARTING_FRACTION,
	UI_EMOJI_HEART_TIER_THRESHOLD,
	UI_IMAGE_CELEBRATION_TIER_THRESHOLD,
} from './stats-purchase-wizard';
import useAvailableUpgradeTiers from './use-available-upgrade-tiers';
import './styles.scss';

interface StatsCommercialPurchaseProps {
	siteId: number | null;
	siteSlug: string;
	planValue: number;
	currencyCode: string;
	adminUrl: string;
	redirectUri: string;
	from: string;
}

interface StatsSingleItemPagePurchaseProps {
	siteSlug: string;
	planValue: number;
	currencyCode: string;
	redirectUri: string;
	from: string;
	siteId: number | null;
	isCommercial: boolean | null;
}

interface StatsSingleItemPersonalPurchasePageProps {
	siteSlug: string;
	redirectUri: string;
	from: string;
	siteId: number | null;
	maxSliderPrice: number;
	pwywProduct: {
		cost: number;
		currency_code: string;
	};
	disableFreeProduct: boolean;
}

interface StatsPersonalPurchaseProps {
	siteId: number | null;
	siteSlug: string;
	maxSliderPrice: number;
	pwywProduct: {
		cost: number;
		currency_code: string;
	};
	redirectUri: string;
	from: string;
	adminUrl: string;
	disableFreeProduct: boolean;
}

interface StatsCommercialFlowOptOutFormProps {
	siteId: number | null;
	siteSlug: string;
	isCommercial: boolean | null;
}

const COMPONENT_CLASS_NAME = 'stats-purchase-single';
const FLAGS_CHECKOUT_FLOWS_V2 = 'stats/checkout-flows-v2';

const StatsUpgradeInstructions = () => {
	const translate = useTranslate();
	return (
		<div>
			<p>
				{ translate(
					'Upgrade and increase your site views limit to continue using our advanced stats features.'
				) }
			</p>
			<div className="stats-purchase-wizard__notice">
				{ translate(
					'The remainder of your current plan will be credited towards the upgrade, ensuring you only pay the price difference. Starting from the next billing cycle, standard charges will apply.'
				) }
			</div>
		</div>
	);
};

const StatsCommercialPurchase = ( {
	siteId,
	siteSlug,
	planValue,
	currencyCode,
	from,
	adminUrl,
	redirectUri,
}: StatsCommercialPurchaseProps ) => {
	const translate = useTranslate();
	const isWPCOMSite = useSelector( ( state ) => siteId && getIsSiteWPCOM( state, siteId ) );
	const isTierUpgradeSliderEnabled = config.isEnabled( 'stats/tier-upgrade-slider' );
	const tiers = useAvailableUpgradeTiers( siteId ) || [];
	const { isCommercialOwned } = useStatsPurchases( siteId );

	// The button of @automattic/components has built-in color scheme support for Calypso.
	const ButtonComponent = isWPCOMSite ? CalypsoButton : Button;
	const startingTierQuantity = getTierQuentity( tiers[ 0 ], isTierUpgradeSliderEnabled );
	const [ purchaseTierQuantity, setPurchaseTierQuantity ] = useState( startingTierQuantity ?? 0 );

	const isOdysseyStats = config.isEnabled( 'is_running_in_jetpack_site' );

	const handleSliderChanged = useCallback( ( value: number ) => {
		setPurchaseTierQuantity( value );
	}, [] );

	const pageTitle = config.isEnabled( FLAGS_CHECKOUT_FLOWS_V2 )
		? translate( 'Welcome to Jetpack Stats' )
		: translate( 'Jetpack Stats' );

	const continueButtonText = config.isEnabled( FLAGS_CHECKOUT_FLOWS_V2 )
		? translate( 'Upgrade and continue' )
		: translate( 'Purchase' );

	// TODO: Remove isTierUpgradeSliderEnabled code paths.

	return (
		<>
			<h1>{ pageTitle }</h1>
			{ ! isCommercialOwned && (
				<>
					<p>{ translate( 'The most advanced stats Jetpack has to offer.' ) }</p>
					<StatsBenefitsCommercial />
				</>
			) }
			{ isCommercialOwned && <StatsUpgradeInstructions /> }
			{ ! isTierUpgradeSliderEnabled && (
				<>
					<StatsCommercialPriceDisplay planValue={ planValue } currencyCode={ currencyCode } />
					<ButtonComponent
						variant="primary"
						primary={ isWPCOMSite ? true : undefined }
						onClick={ () =>
							gotoCheckoutPage( { from, type: 'commercial', siteSlug, adminUrl, redirectUri } )
						}
					>
						{ translate( 'Get Stats' ) }
					</ButtonComponent>
				</>
			) }
			{ isTierUpgradeSliderEnabled && (
				<>
					<StatsCommercialUpgradeSlider
						currencyCode={ currencyCode }
						analyticsEventName={ `${
							isOdysseyStats ? 'jetpack_odyssey' : 'calypso'
						}_stats_purchase_commercial_slider_clicked` }
						onSliderChange={ handleSliderChanged }
					/>
					<ButtonComponent
						variant="primary"
						primary={ isWPCOMSite ? true : undefined }
						onClick={ () =>
							gotoCheckoutPage( {
								from,
								type: 'commercial',
								siteSlug,
								adminUrl,
								redirectUri,
								price: undefined,
								quantity: purchaseTierQuantity,
							} )
						}
					>
						{ continueButtonText }
					</ButtonComponent>
				</>
			) }
		</>
	);
};

const StatsPersonalPurchase = ( {
	siteId,
	siteSlug,
	maxSliderPrice,
	pwywProduct,
	redirectUri,
	from,
	adminUrl,
	disableFreeProduct = false,
}: StatsPersonalPurchaseProps ) => {
	const translate = useTranslate();
	const sliderStepPrice = pwywProduct.cost / MIN_STEP_SPLITS;

	const steps = Math.floor( maxSliderPrice / sliderStepPrice );
	// We need the exact position, otherwise the caculated pricing would not be the same as the one in the slider.
	const defaultStartingValue = Math.floor( steps * DEFAULT_STARTING_FRACTION );
	const uiEmojiHeartTier = Math.floor( steps * UI_EMOJI_HEART_TIER_THRESHOLD );
	const uiImageCelebrationTier = steps * UI_IMAGE_CELEBRATION_TIER_THRESHOLD;

	const [ subscriptionValue, setSubscriptionValue ] = useState( defaultStartingValue );

	// change the plan to commercial on the personal plan confirmation
	const handlePlanSwap = ( e: React.MouseEvent ) => {
		e.preventDefault();
		const isOdysseyStats = config.isEnabled( 'is_running_in_jetpack_site' );
		const event_from = isOdysseyStats ? 'jetpack_odyssey' : 'calypso';
		recordTracksEvent( `${ event_from }_stats_plan_switched_from_personal_to_commercial` );

		page( `/stats/purchase/${ siteSlug }?productType=commercial&flags=stats/type-detection` );
	};

	const pageTitle = config.isEnabled( FLAGS_CHECKOUT_FLOWS_V2 )
		? translate( 'Name your price for Jetpack Stats' )
		: translate( 'Jetpack Stats' );

	return (
		<>
			<h1>{ pageTitle }</h1>
			<p>{ translate( 'The most advanced stats Jetpack has to offer.' ) }</p>
			<PersonalPurchase
				subscriptionValue={ subscriptionValue }
				setSubscriptionValue={ setSubscriptionValue }
				defaultStartingValue={ defaultStartingValue }
				handlePlanSwap={ ( e ) => handlePlanSwap( e ) }
				currencyCode={ pwywProduct?.currency_code }
				siteId={ siteId }
				siteSlug={ siteSlug }
				sliderSettings={ {
					minSliderPrice: disableFreeProduct ? sliderStepPrice : 0,
					sliderStepPrice,
					maxSliderPrice,
					uiEmojiHeartTier,
					uiImageCelebrationTier,
				} }
				adminUrl={ adminUrl }
				redirectUri={ redirectUri }
				from={ from }
				isStandalone={ true }
			/>
		</>
	);
};

const StatsSingleItemPersonalPurchasePage = ( {
	siteSlug,
	redirectUri,
	from,
	siteId,
	maxSliderPrice,
	pwywProduct,
	disableFreeProduct,
}: StatsSingleItemPersonalPurchasePageProps ) => {
	const adminUrl = useSelector( ( state ) => getSiteAdminUrl( state, siteId ) );

	return (
		<StatsSingleItemPagePurchaseFrame>
			<StatsPersonalPurchase
				siteId={ siteId }
				siteSlug={ siteSlug }
				adminUrl={ adminUrl || '' }
				redirectUri={ redirectUri }
				from={ from }
				maxSliderPrice={ maxSliderPrice }
				pwywProduct={ pwywProduct }
				disableFreeProduct={ disableFreeProduct }
			/>
		</StatsSingleItemPagePurchaseFrame>
	);
};

const StatsSingleItemPagePurchase = ( {
	siteSlug,
	planValue,
	currencyCode,
	redirectUri,
	from,
	siteId,
	isCommercial,
}: StatsSingleItemPagePurchaseProps ) => {
	const adminUrl = useSelector( ( state ) => getSiteAdminUrl( state, siteId ) );
	const { isCommercialOwned } = useStatsPurchases( siteId );

	return (
		<>
			<StatsSingleItemPagePurchaseFrame>
				<StatsCommercialPurchase
					siteId={ siteId }
					siteSlug={ siteSlug }
					planValue={ planValue }
					currencyCode={ currencyCode }
					adminUrl={ adminUrl || '' }
					redirectUri={ redirectUri }
					from={ from }
				/>
			</StatsSingleItemPagePurchaseFrame>
			{ ! isCommercialOwned && (
				<StatsSingleItemCard>
					<StatsCommercialFlowOptOutForm
						isCommercial={ isCommercial }
						siteId={ siteId }
						siteSlug={ siteSlug }
					/>
				</StatsSingleItemCard>
			) }
		</>
	);
};

function StatsCommercialFlowOptOutForm( {
	isCommercial,
	siteId,
	siteSlug,
}: StatsCommercialFlowOptOutFormProps ) {
	const translate = useTranslate();
	const isOdysseyStats = config.isEnabled( 'is_running_in_jetpack_site' );
	const isJetpackSupport: boolean = useSelector( ( state ) =>
		Boolean( isJetpackSite( state, siteId, { treatAtomicAsJetpackSite: false } ) )
	);

	// Checkbox state
	const [ isAdsChecked, setAdsChecked ] = useState( false );
	const [ isSellingChecked, setSellingChecked ] = useState( false );
	const [ isBusinessChecked, setBusinessChecked ] = useState( false );
	const [ isDonationChecked, setDonationChecked ] = useState( false );

	const handleSwitchToPersonalClick = () => {
		const event_from = isOdysseyStats ? 'jetpack_odyssey' : 'calypso';
		recordTracksEvent( `${ event_from }_stats_purchase_commercial_switch_to_personal_clicked` );
		setTimeout( () => page( `/stats/purchase/${ siteSlug }?productType=personal` ), 250 );
	};

	const handleRequestUpdateClick = () => {
		const event_from = isOdysseyStats ? 'jetpack_odyssey' : 'calypso';
		recordTracksEvent( `${ event_from }_stats_purchase_commercial_update_classification_clicked` );

		// No need to translate this as we'd prefer customer communication to be in English.
		const subject = 'Jetpack Stats Commercial Classification Dispute';
		const message = `Hi Jetpack Team,\n
I'm writing to dispute the classification of my site '${ siteSlug }' as commercial.\n
I can confirm that,
- I don't have ads on my site.
- I don't sell products/services on my site.
- I don't promote a business on my site.
- I don't solicit donations or sponsorships on my site.\n
Could you please take a look at my site and update the classification if necessary?\n
Thanks\n\n`;

		// For Jetpack sites, link to https://jetpack.com/contact-support/ with pre-filled form.
		if ( isJetpackSupport ) {
			window.open(
				`https://jetpack.com/contact-support/?assistant=false&url=${ siteSlug }&subject=${ encodeURIComponent(
					subject
				) }&message=${ encodeURIComponent( message ) }`
			);
			return;
		}

		// TODO: Assess whether this is appropriate escalation approach for Dotcom sites.
		const mailTo = 'help@wordpress.com';
		const emailHref = `mailto:${ mailTo }?subject=${ encodeURIComponent(
			subject
		) }&body=${ encodeURIComponent( message ) }`;
		window.open( emailHref );
	};

	const isFormSubmissionDisabled = () => {
		return ! isAdsChecked || ! isSellingChecked || ! isBusinessChecked || ! isDonationChecked;
	};

	// Message, button text, and handler differ based on isCommercial flag.
	const formMessage = isCommercial
		? translate(
				'If you think we misidentified your site as commercial, confirm the information below and we’ll take a look.'
		  )
		: translate( 'To use a non-commercial license you must agree to the following:' );
	const formButton = isCommercial ? translate( 'Request update' ) : translate( 'Continue' );
	const formHandler = isCommercial ? handleRequestUpdateClick : handleSwitchToPersonalClick;

	return (
		<>
			<h1>{ translate( 'Continue with a non-commercial license' ) }</h1>
			<p>{ formMessage }</p>
			<div className={ `${ COMPONENT_CLASS_NAME }__personal-checklist` }>
				<ul>
					<li>
						<CheckboxControl
							className={ `${ COMPONENT_CLASS_NAME }__control--checkbox` }
							checked={ isAdsChecked }
							label={ translate( `I don't have ads on my site` ) }
							onChange={ ( value: boolean ) => {
								setAdsChecked( value );
							} }
						/>
					</li>
					<li>
						<CheckboxControl
							className={ `${ COMPONENT_CLASS_NAME }__control--checkbox` }
							checked={ isSellingChecked }
							label={ translate( `I don't sell products/services on my site` ) }
							onChange={ ( value: boolean ) => {
								setSellingChecked( value );
							} }
						/>
					</li>
					<li>
						<CheckboxControl
							className={ `${ COMPONENT_CLASS_NAME }__control--checkbox` }
							checked={ isBusinessChecked }
							label={ translate( `I don't promote a business on my site` ) }
							onChange={ ( value: boolean ) => {
								setBusinessChecked( value );
							} }
						/>
					</li>
					<li>
						<CheckboxControl
							className={ `${ COMPONENT_CLASS_NAME }__control--checkbox` }
							checked={ isDonationChecked }
							label={ translate( `I don't solicit donations or sponsorships on my site` ) }
							onChange={ ( value ) => {
								setDonationChecked( value );
							} }
						/>
					</li>
				</ul>
			</div>
			<div className={ `${ COMPONENT_CLASS_NAME }__personal-checklist-button` }>
				<Button variant="secondary" disabled={ isFormSubmissionDisabled() } onClick={ formHandler }>
					{ formButton }
				</Button>
			</div>
		</>
	);
}

export { StatsSingleItemPagePurchase, StatsSingleItemPersonalPurchasePage };

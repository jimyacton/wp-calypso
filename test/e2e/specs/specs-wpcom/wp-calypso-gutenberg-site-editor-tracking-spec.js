/**
 * External dependencies
 */
import config from 'config';
import assert from 'assert';

/**
 * Internal dependencies
 */
import LoginFlow from '../../lib/flows/login-flow.js';

import SidebarComponent from '../../lib/components/sidebar-component.js';
import SiteEditorPage from '../../lib/pages/site-editor-page.js';
import SiteEditorComponent from '../../lib/components/site-editor-component.js';

import * as driverManager from '../../lib/driver-manager.js';
import * as driverHelper from '../../lib/driver-helper.js';
import * as dataHelper from '../../lib/data-helper.js';
import { clearEventsStack, getEventsStack } from '../../lib/gutenberg/tracking/utils.js';
import { createGeneralTests } from '../../lib/gutenberg/tracking/general-tests.js';
import { By } from 'selenium-webdriver';

const mochaTimeOut = config.get( 'mochaTimeoutMS' );
const screenSize = driverManager.currentScreenSize();
const host = dataHelper.getJetpackHost();

const siteEditorUser = 'siteEditorSimpleSiteUser';

const clickGlobalStylesButton = async ( driver ) =>
	await driverHelper.clickWhenClickable(
		driver,
		By.css( '.edit-site-header__actions button[aria-label="Global Styles"]' )
	);

const clickBlockSettingsButton = async ( driver ) =>
	await driverHelper.clickWhenClickable(
		driver,
		By.css( '.edit-site-header__actions button[aria-label="Settings"]' )
	);

const clickNthTabInGlobalStylesSidebar = async ( driver, tabIndex ) =>
	await driverHelper.clickWhenClickable(
		driver,
		By.css(
			`.edit-site-global-styles-sidebar .components-tab-panel__tabs button:nth-child(${ tabIndex })`
		)
	);

const clickGlobalStylesRootTab = async ( driver ) =>
	await clickNthTabInGlobalStylesSidebar( driver, 1 );

const clickGlobalStylesBlockTypeTab = async ( driver ) =>
	await clickNthTabInGlobalStylesSidebar( driver, 2 );

const getGlobalStylesTabSelectedEvents = async ( driver ) => {
	const eventsStack = await getEventsStack( driver );
	return eventsStack.filter(
		( [ eventName ] ) => eventName === 'wpcom_block_editor_global_styles_tab_selected'
	);
};

const GLOBAL_STYLES_ROOT_TAB_NAME = 'root';
const GLOBAL_STYLES_BLOCK_TYPE_TAB_NAME = 'block-type';

describe( `[${ host }] Calypso Gutenberg Site Editor Tracking: (${ screenSize })`, function () {
	this.timeout( mochaTimeOut );

	// TODO: Create an edge user with a Site Editor enabled site
	before( async function () {
		if ( process.env.GUTENBERG_EDGE === 'true' ) {
			this.skip();
		}
	} );

	describe( 'Tracking Site Editor: @parallel', function () {
		it( 'Log in with site editor user and Site Editor opens successfully', async function () {
			const loginFlow = new LoginFlow( this.driver, host === 'WPCOM' ? siteEditorUser : undefined );
			await loginFlow.loginAndSelectMySite();

			const sidebar = await SidebarComponent.Expect( this.driver );
			await sidebar.selectSiteEditor();

			// Wait until Site Editor page is loaded
			await SiteEditorPage.Expect( this.driver );

			const editor = await SiteEditorComponent.Expect( this.driver );
			await editor.waitForTemplateToLoad();
			await editor.waitForTemplatePartsToLoad();
		} );

		createGeneralTests( { it, editorType: 'site' } );

		describe( 'Tracks "wpcom_block_editor_global_styles_tab_selected', function () {
			it( 'when Global Styles sidebar is opened', async function () {
				await clickGlobalStylesButton( this.driver );

				const eventsStack = await getEventsStack( this.driver );
				const tabSelectedEvents = eventsStack.filter(
					( [ eventName ] ) => eventName === 'wpcom_block_editor_global_styles_tab_selected'
				);
				assert.strictEqual( tabSelectedEvents.length, 1 );
				const [ , eventData ] = tabSelectedEvents[ 0 ];
				assert.strictEqual( eventData.tab, GLOBAL_STYLES_ROOT_TAB_NAME );
				assert.strictEqual( eventData.open, true );
			} );

			it( 'when Global Styles sidebar is closed', async function () {
				// Note the sidebar is already open here because of the previous test.
				await clickGlobalStylesButton( this.driver );

				const tabSelectedEvents = await getGlobalStylesTabSelectedEvents( this.driver );
				assert.strictEqual( tabSelectedEvents.length, 1 );
				const [ , eventData ] = tabSelectedEvents[ 0 ];
				assert.strictEqual( eventData.tab, GLOBAL_STYLES_ROOT_TAB_NAME );
				assert.strictEqual( eventData.open, false );
			} );

			it( `when Global Styles sidebar is closed by opening another sidebar (tab = ${ GLOBAL_STYLES_ROOT_TAB_NAME })`, async function () {
				await clickGlobalStylesButton( this.driver );
				await clickBlockSettingsButton( this.driver );

				const tabSelectedEvents = await getGlobalStylesTabSelectedEvents( this.driver );
				assert.strictEqual( tabSelectedEvents.length, 2 );
				const [ , eventData ] = tabSelectedEvents[ 0 ];
				assert.strictEqual( eventData.tab, GLOBAL_STYLES_ROOT_TAB_NAME );
				assert.strictEqual( eventData.open, false );
			} );

			it( `when Global Styles sidebar is closed by opening another sidebar (tab = ${ GLOBAL_STYLES_BLOCK_TYPE_TAB_NAME })`, async function () {
				await clickGlobalStylesButton( this.driver );
				await clickGlobalStylesBlockTypeTab( this.driver );
				await clickBlockSettingsButton( this.driver );

				const tabSelectedEvents = await getGlobalStylesTabSelectedEvents( this.driver );
				assert.strictEqual( tabSelectedEvents.length, 3 );
				const [ , eventData ] = tabSelectedEvents[ 0 ];
				assert.strictEqual( eventData.tab, GLOBAL_STYLES_BLOCK_TYPE_TAB_NAME );
				assert.strictEqual( eventData.open, false );
			} );

			it( 'when tab is changed in Global Styles sidebar', async function () {
				await clickGlobalStylesButton( this.driver );
				await clickGlobalStylesBlockTypeTab( this.driver );
				await clickGlobalStylesRootTab( this.driver );

				const tabSelectedEvents = await getGlobalStylesTabSelectedEvents( this.driver );
				assert.strictEqual( tabSelectedEvents.length, 3 );
				const [ , blockTypeSelectedEventData ] = tabSelectedEvents[ 1 ];
				assert.strictEqual( blockTypeSelectedEventData.tab, GLOBAL_STYLES_BLOCK_TYPE_TAB_NAME );
				assert.strictEqual( blockTypeSelectedEventData.open, true );
				const [ , rootSelectedEventData ] = tabSelectedEvents[ 2 ];
				assert.strictEqual( rootSelectedEventData.tab, GLOBAL_STYLES_ROOT_TAB_NAME );
				assert.strictEqual( rootSelectedEventData.open, true );
			} );

			it( 'should not trigger the event when clicking on the already active tab', async function () {
				await clickGlobalStylesRootTab( this.driver );
				await clickGlobalStylesRootTab( this.driver );
				await clickGlobalStylesRootTab( this.driver );

				const tabSelectedEvents = await getGlobalStylesTabSelectedEvents( this.driver );
				assert.strictEqual( tabSelectedEvents.length, 0 );
			} );
		} );

		afterEach( clearEventsStack );
	} );
} );

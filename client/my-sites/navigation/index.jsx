import config from '@automattic/calypso-config';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import AsyncLoad from 'calypso/components/async-load';
import { withCurrentRoute } from 'calypso/components/route';
import GlobalSidebar from 'calypso/layout/global-sidebar';
import SitePicker from 'calypso/my-sites/picker';
import MySitesSidebarUnifiedBody from 'calypso/my-sites/sidebar/body';
import {
	getShouldShowGlobalSidebar,
	getShouldShowGlobalSiteSidebar,
} from 'calypso/state/global-sidebar/selectors';
import { getSelectedSiteId } from 'calypso/state/ui/selectors';

class MySitesNavigation extends Component {
	static displayName = 'MySitesNavigation';

	preventPickerDefault = ( event ) => {
		event.preventDefault();
		event.stopPropagation();
	};

	renderSidebar() {
		const asyncProps = {
			placeholder: null,
			path: this.props.path,
			siteBasePath: this.props.siteBasePath,
		};

		let asyncSidebar = null;
		let renderSitePicker = true;
		let sitePickerProps = {};

		if ( config.isEnabled( 'jetpack-cloud' ) ) {
			asyncSidebar = (
				<AsyncLoad
					require="calypso/jetpack-cloud/sections/sidebar-navigation/manage-selected-site"
					{ ...asyncProps }
				/>
			);

			// For the new Jetpack cloud sidebar, it has its own site picker.
			renderSitePicker = false;

			sitePickerProps = {
				showManageSitesButton: false,
				showHiddenSites: false,
			};
		} else {
			asyncSidebar = <AsyncLoad require="calypso/my-sites/sidebar" { ...asyncProps } />;

			sitePickerProps = {
				showManageSitesButton: true,
				showHiddenSites: true,
				maxResults: 50,
			};
		}

		return (
			<div className="my-sites__navigation">
				{ renderSitePicker && (
					<SitePicker
						allSitesPath={ this.props.allSitesPath }
						siteBasePath={ this.props.siteBasePath }
						onClose={ this.preventPickerDefault }
						{ ...sitePickerProps }
					/>
				) }
				{ asyncSidebar }
			</div>
		);
	}

	renderGlobalSidebar() {
		const asyncProps = {
			placeholder: null,
			path: this.props.path,
		};
		return (
			<GlobalSidebar { ...asyncProps }>
				<MySitesSidebarUnifiedBody path={ this.props.path } />
			</GlobalSidebar>
		);
	}

	// TODO: Add styles
	renderGlobalSiteSidebar() {
		return (
			<GlobalSidebar path={ this.props.path }>
				<MySitesSidebarUnifiedBody path={ this.props.path } />
			</GlobalSidebar>
		);
	}

	render() {
		if ( this.props.isGlobalSidebarVisible ) {
			return this.renderGlobalSidebar();
		}
		if ( this.props.isGlobalSiteSidebarVisible ) {
			return this.renderGlobalSiteSidebar();
		}
		return this.renderSidebar();
	}
}

export default withCurrentRoute(
	connect( ( state, { currentSection } ) => {
		const sectionGroup = currentSection?.group ?? null;
		const siteId = getSelectedSiteId( state );
		const shouldShowGlobalSidebar = getShouldShowGlobalSidebar( state, siteId, sectionGroup );
		const shouldShowGlobalSiteSidebar = getShouldShowGlobalSiteSidebar(
			state,
			siteId,
			sectionGroup
		);
		return {
			isGlobalSidebarVisible: shouldShowGlobalSidebar,
			isGlobalSiteSidebarVisible: shouldShowGlobalSiteSidebar,
		};
	}, null )( MySitesNavigation )
);

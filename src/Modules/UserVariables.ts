'use strict';

// External Modules
import { r as RethinkDB } from 'rethinkdb-ts';

// Internal Modules
import { PermissionSystem } from './';

// Types
import { RDatum } from 'rethinkdb-ts';
export interface UserVariables <GenericUser extends any>
{
	user: RDatum<GenericUser>
};

export function generateUserVariablesQuery({domainId, userId, system}: {domainId: string, userId: string, system: PermissionSystem <any, any, any, any>})
{
	const query = RethinkDB
		.expr
		(
			{
				user: system.queries.user({domainId, userId})
			}
		);
	return query;
};
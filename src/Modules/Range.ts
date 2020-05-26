'use strict';

// External Modules
import { r as RethinkDB } from 'rethinkdb-ts';
import { run as rethinkRun } from '@chris-talman/rethink-utilities';

// Internal Modules
import { PermissionSystem } from './';
import { generateUserVariablesQuery } from './UserVariables';

// Types
import { RDatum } from 'rethinkdb-ts';
import { Permission } from './';
import { UserVariables } from './UserVariables';

// Constants
const NEGATED = true;
const NOT_NEGATED = false;
const NOT_DELETED = false;

/** Determines whether the user has at least one permission in a range of possible permission types. */
export async function isUserAuthorisedByRange <GenericPermissionTypes extends Array<string>> (this: PermissionSystem <any, any, any, any>, {domainId, userId, permissions}: {domainId: string, userId: string, permissions: GenericPermissionTypes})
{
	const query = generateUserVariablesQuery({domainId, userId, system: this})
		.do
		(
			(variables: RDatum <UserVariables <any>>) => RethinkDB
				.or
				(
					this.queries.globalAuthorised ? this.queries.globalAuthorised({domainId, userId, user: variables('user')}) : false,
					RethinkDB.and
					(
						this.queries.organisationAuthorised ? this.queries.organisationAuthorised({domainId, userId, user: variables('user')}) : true,
						this.queries.userRoles({domainId, userId, user: variables('user')})
							.do
							(
								(userRoles: ReturnType<typeof this.queries.userRoles>) => RethinkDB
									.and
									(
										userRoles
											.concatMap
											(
												role => RethinkDB
													.table<Permission <any>>(this.table)
													.getAll
													(
														RethinkDB.args
														(
															permissions.map
															(
																permissionType => [ domainId, permissionType, NOT_NEGATED, role('id'), role('type'), NOT_DELETED ]
															)
														),
														{ index: this.indexes.range }
													)
											)
											.count()
											.gt(0),
										userRoles
											.concatMap
											(
												role => RethinkDB
													.table<Permission <any>>(this.table)
													.getAll
													(
														RethinkDB.args
														(
															permissions.map
															(
																permissionType => [ domainId, permissionType, NEGATED, role('id'), role('type'), NOT_DELETED ]
															)
														),
														{ index: this.indexes.range }
													)
											)
											.group('type')
											.ungroup()
											.count()
											.lt(permissions.length)
									)
							)
					)
				)
		);
	const authorised = await rethinkRun({query, options: {throwRuntime: false}}) as boolean;
	return authorised;
};
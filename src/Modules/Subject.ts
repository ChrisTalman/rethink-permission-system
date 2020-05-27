'use strict';

// External Modules
import { r as RethinkDB } from 'rethinkdb-ts';
import { run as rethinkRun } from '@chris-talman/rethink-utilities';

// Internal Modules
import { PermissionSystem } from './';
import { generateUserVariablesQuery } from './UserVariables';

// Types
import { RDatum } from 'rethinkdb-ts';
import { Permission, PermissionTargetEntity } from './';
import { UserVariables } from './UserVariables';

// Constants
const NEGATED = true;
const NOT_NEGATED = false;
const NOT_DELETED = false;

/** Determines whether the user has the permission for the subject. */
export async function isUserAuthorisedBySubject <GenericPermissionType extends string, GenericTargetEntity extends PermissionTargetEntity <any>>
(
	this: PermissionSystem <any, any, any, any>,
	{domainId, userId, permission, subject}: {domainId: string, userId: string, permission: GenericPermissionType, subject: GenericTargetEntity}
)
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
														[ domainId, permission, NOT_NEGATED, role('id'), role('type'), subject.id, subject.type, NOT_DELETED ],
														{ index: this.indexes.subject }
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
														[ domainId, permission, NEGATED, role('id'), role('type'), subject.id, subject.type, NOT_DELETED ],
														{ index: this.indexes.subject }
													)
											)
											.count()
											.eq(0)
									)
							)
					)
				)
		);
    const authorised = await rethinkRun({query, options: {throwRuntime: false}}) as boolean;
    return authorised;
};